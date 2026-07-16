import { decryptText, encryptText, namespaceFor } from './crypto';
import type { Chat, ChatMessage, ChatSummary, EncryptedValue, UserSettings } from './types';

const DB_NAME = 'opro-ui';
const DB_VERSION = 1;
const SETTINGS_STORE = 'settings';
const CHATS_STORE = 'chats';
const MESSAGES_STORE = 'messages';
const MESSAGES_BY_CHAT = 'byChatPosition';
let dbPromise: Promise<IDBDatabase> | undefined;
let writeQueue: Promise<unknown> = Promise.resolve();

interface SettingsRecord {
  namespace: string;
  apiKey: EncryptedValue;
  preset: EncryptedValue;
  model: string;
}

interface ChatRecord {
  namespace: string;
  id: string;
  title: EncryptedValue;
  createdAt: number;
  updatedAt: number;
}

interface MessageRecord {
  namespace: string;
  chatId: string;
  id: string;
  position: number;
  role: ChatMessage['role'];
  content: EncryptedValue;
  createdAt: number;
  model: string;
}

function settingsContext(field: 'apiKey' | 'preset'): string { return `settings:${field}`; }
function titleContext(chatId: string): string { return `chat:${chatId}:title`; }
function messageContext(chatId: string, messageId: string): string { return `message:${chatId}:${messageId}:content`; }

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(SETTINGS_STORE, { keyPath: 'namespace' });
      db.createObjectStore(CHATS_STORE, { keyPath: ['namespace', 'id'] });
      const messages = db.createObjectStore(MESSAGES_STORE, { keyPath: ['namespace', 'chatId', 'id'] });
      messages.createIndex(MESSAGES_BY_CHAT, ['namespace', 'chatId', 'position'], { unique: true });
    };
    request.onerror = () => reject(request.error ?? new Error('Unable to open local storage.'));
    request.onsuccess = () => resolve(request.result);
  });
  return dbPromise;
}

async function getRecord<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to read local storage.'));
  });
}

async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error('Unable to read local storage.'));
  });
}

async function recordsForChat(namespace: string, chatId: string): Promise<MessageRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const range = IDBKeyRange.bound(
      [namespace, chatId, 0],
      [namespace, chatId, Number.MAX_SAFE_INTEGER],
    );
    const request = db.transaction(MESSAGES_STORE).objectStore(MESSAGES_STORE).index(MESSAGES_BY_CHAT).getAll(range);
    request.onsuccess = () => resolve(request.result as MessageRecord[]);
    request.onerror = () => reject(request.error ?? new Error('Unable to read local storage.'));
  });
}

async function runTransaction(storeNames: string[], action: (stores: Record<string, IDBObjectStore>) => void): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, 'readwrite');
    const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]));
    action(stores);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save local storage.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Unable to save local storage.'));
  });
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

async function encryptedMessage(namespace: string, username: string, chatId: string, message: ChatMessage, position: number): Promise<MessageRecord> {
  return {
    namespace,
    chatId,
    id: message.id,
    position,
    role: message.role,
    content: await encryptText(username, messageContext(chatId, message.id), message.content),
    createdAt: message.createdAt,
    model: message.model,
  };
}

export async function getSettings(username: string): Promise<UserSettings> {
  const namespace = await namespaceFor(username);
  const record = await getRecord<SettingsRecord>(SETTINGS_STORE, namespace);
  if (!record) return { apiKey: '', preset: '', model: 'openrouter/auto' };
  const [apiKey, preset] = await Promise.all([
    decryptText(username, settingsContext('apiKey'), record.apiKey),
    decryptText(username, settingsContext('preset'), record.preset),
  ]);
  return { apiKey, preset, model: record.model };
}

export async function saveSettings(username: string, settings: UserSettings): Promise<void> {
  await enqueue(async () => {
    const namespace = await namespaceFor(username);
    const [apiKey, preset] = await Promise.all([
      encryptText(username, settingsContext('apiKey'), settings.apiKey),
      encryptText(username, settingsContext('preset'), settings.preset),
    ]);
    await runTransaction([SETTINGS_STORE], ({ settings: store }) => {
      store.put({ namespace, apiKey, preset, model: settings.model } satisfies SettingsRecord);
    });
  });
}

export async function getChats(username: string): Promise<ChatSummary[]> {
  const namespace = await namespaceFor(username);
  const records = (await getAllRecords<ChatRecord>(CHATS_STORE))
    .filter((record) => record.namespace === namespace)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return Promise.all(records.map(async (record) => ({
    id: record.id,
    title: await decryptText(username, titleContext(record.id), record.title),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })));
}

export async function getChat(username: string, id: string): Promise<Chat | undefined> {
  const namespace = await namespaceFor(username);
  const record = await getRecord<ChatRecord>(CHATS_STORE, [namespace, id]);
  if (!record) return undefined;
  const storedMessages = await recordsForChat(namespace, id);
  const [title, messages] = await Promise.all([
    decryptText(username, titleContext(id), record.title),
    Promise.all(storedMessages.map(async (message) => ({
      id: message.id,
      role: message.role,
      content: await decryptText(username, messageContext(id, message.id), message.content),
      createdAt: message.createdAt,
      model: message.model,
    }))),
  ]);
  return { id, title, createdAt: record.createdAt, updatedAt: record.updatedAt, messages };
}

export async function createChat(username: string, firstMessage: ChatMessage): Promise<Chat> {
  return enqueue(async () => {
    const namespace = await namespaceFor(username);
    const id = crypto.randomUUID();
    const chatRecord: ChatRecord = {
      namespace,
      id,
      title: await encryptText(username, titleContext(id), 'Untitled'),
      createdAt: firstMessage.createdAt,
      updatedAt: firstMessage.createdAt,
    };
    const messageRecord = await encryptedMessage(namespace, username, id, firstMessage, 0);
    await runTransaction([CHATS_STORE, MESSAGES_STORE], (stores) => {
      stores[CHATS_STORE].add(chatRecord);
      stores[MESSAGES_STORE].add(messageRecord);
    });
    return { id, title: 'Untitled', createdAt: firstMessage.createdAt, updatedAt: firstMessage.createdAt, messages: [firstMessage] };
  });
}

export async function appendMessage(username: string, chatId: string, message: ChatMessage): Promise<void> {
  await enqueue(async () => {
    const namespace = await namespaceFor(username);
    const chat = await getRecord<ChatRecord>(CHATS_STORE, [namespace, chatId]);
    if (!chat) throw new Error('Chat not found.');
    const messages = await recordsForChat(namespace, chatId);
    const record = await encryptedMessage(namespace, username, chatId, message, messages.length);
    chat.updatedAt = message.createdAt;
    await runTransaction([CHATS_STORE, MESSAGES_STORE], (stores) => {
      stores[CHATS_STORE].put(chat);
      stores[MESSAGES_STORE].add(record);
    });
  });
}

export async function editMessageAndTruncate(username: string, chatId: string, message: ChatMessage, updatedAt: number): Promise<void> {
  await enqueue(async () => {
    const namespace = await namespaceFor(username);
    const chat = await getRecord<ChatRecord>(CHATS_STORE, [namespace, chatId]);
    if (!chat) throw new Error('Chat not found.');
    const messages = await recordsForChat(namespace, chatId);
    const index = messages.findIndex((record) => record.id === message.id);
    if (index < 0) throw new Error('Message not found.');
    const changed = await encryptedMessage(namespace, username, chatId, message, messages[index].position);
    chat.updatedAt = updatedAt;
    await runTransaction([CHATS_STORE, MESSAGES_STORE], (stores) => {
      stores[CHATS_STORE].put(chat);
      stores[MESSAGES_STORE].put(changed);
      for (const removed of messages.slice(index + 1)) stores[MESSAGES_STORE].delete([namespace, chatId, removed.id]);
    });
  });
}

export async function renameChat(username: string, id: string, title: string): Promise<void> {
  await enqueue(async () => {
    const namespace = await namespaceFor(username);
    const chat = await getRecord<ChatRecord>(CHATS_STORE, [namespace, id]);
    if (!chat) return;
    chat.title = await encryptText(username, titleContext(id), title.trim() || 'Untitled');
    chat.updatedAt = Date.now();
    await runTransaction([CHATS_STORE], ({ chats: store }) => { store.put(chat); });
  });
}

export async function deleteChat(username: string, id: string): Promise<void> {
  await enqueue(async () => {
    const namespace = await namespaceFor(username);
    const messages = await recordsForChat(namespace, id);
    await runTransaction([CHATS_STORE, MESSAGES_STORE], (stores) => {
      stores[CHATS_STORE].delete([namespace, id]);
      for (const message of messages) stores[MESSAGES_STORE].delete([namespace, id, message.id]);
    });
  });
}

export function resetDbForTests(): void {
  dbPromise?.then((db) => db.close());
  dbPromise = undefined;
  writeQueue = Promise.resolve();
}
