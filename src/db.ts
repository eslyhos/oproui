import { decryptVault, encryptVault, namespaceFor } from './crypto';
import type { Chat, ChatMessage, UserSettings, UserVault, VaultEnvelope } from './types';

const DB_NAME = 'opro-ui';
const DB_VERSION = 1;
const STORE = 'vaults';
let dbPromise: Promise<IDBDatabase> | undefined;
let writeQueue: Promise<unknown> = Promise.resolve();

function emptyVault(): UserVault {
  return { settings: { apiKey: '', preset: '', model: 'openrouter/auto' }, chats: [] };
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'namespace' });
    request.onerror = () => reject(request.error ?? new Error('Unable to open local storage.'));
    request.onsuccess = () => resolve(request.result);
  });
  return dbPromise;
}

async function getEnvelope(namespace: string): Promise<VaultEnvelope | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(namespace);
    request.onsuccess = () => resolve(request.result as VaultEnvelope | undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to read local storage.'));
  });
}

async function putEnvelope(envelope: VaultEnvelope): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(envelope);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save local storage.'));
  });
}

export async function loadVault(username: string): Promise<UserVault> {
  const envelope = await getEnvelope(await namespaceFor(username));
  return envelope ? decryptVault(username, envelope) : emptyVault();
}

async function mutateVault<T>(username: string, mutation: (vault: UserVault) => T | Promise<T>): Promise<T> {
  const operation = writeQueue.then(async () => {
    const vault = await loadVault(username);
    const result = await mutation(vault);
    await putEnvelope(await encryptVault(username, vault));
    return result;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}

export async function getSettings(username: string): Promise<UserSettings> {
  return (await loadVault(username)).settings;
}

export async function saveSettings(username: string, settings: UserSettings): Promise<void> {
  await mutateVault(username, (vault) => { vault.settings = { ...settings }; });
}

export async function getChats(username: string): Promise<Chat[]> {
  return (await loadVault(username)).chats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getChat(username: string, id: string): Promise<Chat | undefined> {
  return (await loadVault(username)).chats.find((chat) => chat.id === id);
}

export async function createChat(username: string, firstMessage: ChatMessage): Promise<Chat> {
  return mutateVault(username, (vault) => {
    const chat: Chat = { id: crypto.randomUUID(), title: 'Untitled', createdAt: firstMessage.createdAt, updatedAt: firstMessage.createdAt, messages: [firstMessage] };
    vault.chats.push(chat);
    return structuredClone(chat);
  });
}

export async function updateChat(username: string, chat: Chat): Promise<void> {
  await mutateVault(username, (vault) => {
    const index = vault.chats.findIndex((item) => item.id === chat.id);
    if (index < 0) throw new Error('Chat not found.');
    vault.chats[index] = structuredClone(chat);
  });
}

export async function renameChat(username: string, id: string, title: string): Promise<void> {
  await mutateVault(username, (vault) => {
    const chat = vault.chats.find((item) => item.id === id);
    if (!chat) return;
    chat.title = title.trim() || 'Untitled';
    chat.updatedAt = Date.now();
  });
}

export async function deleteChat(username: string, id: string): Promise<void> {
  await mutateVault(username, (vault) => { vault.chats = vault.chats.filter((chat) => chat.id !== id); });
}

export function resetDbForTests(): void {
  dbPromise?.then((db) => db.close());
  dbPromise = undefined;
  writeQueue = Promise.resolve();
}
