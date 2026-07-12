import type { Chat, Message, UserMeta, UserSettings } from './types';

const DB_NAME = 'openrouter-local-ui';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const chats = db.createObjectStore('chats', { keyPath: 'id' });
      chats.createIndex('namespace', 'namespace');
      chats.createIndex('namespaceUpdatedAt', ['namespace', 'updatedAt']);

      const messages = db.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('chatId', 'chatId');
      messages.createIndex('chatCreatedAt', ['chatId', 'createdAt']);

      db.createObjectStore('settings', { keyPath: 'namespace' });
      db.createObjectStore('meta', { keyPath: 'namespace' });
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  return dbPromise;
}

function store<T>(
  name: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(name, mode);
        const objectStore = tx.objectStore(name);
        let request: IDBRequest<T> | void;
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve(request ? request.result : (undefined as T));
        request = callback(objectStore);
      }),
  );
}

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getAllFromIndex<T>(storeName: string, indexName: string, query: IDBValidKey | IDBKeyRange): Promise<T[]> {
  return store<T[]>(storeName, 'readonly', (s) => s.index(indexName).getAll(query));
}

export async function getChats(namespace: string): Promise<Chat[]> {
  const chats = await getAllFromIndex<Chat>('chats', 'namespace', namespace);
  return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getChat(id: string): Promise<Chat | undefined> {
  return store<Chat | undefined>('chats', 'readonly', (s) => s.get(id));
}

export async function createChat(namespace: string, title = 'New chat'): Promise<Chat> {
  const now = Date.now();
  const chat: Chat = { id: uid('chat'), namespace, title, createdAt: now, updatedAt: now };
  await store('chats', 'readwrite', (s) => s.put(chat));
  return chat;
}

export async function renameChat(id: string, title: string): Promise<void> {
  const chat = await getChat(id);
  if (!chat) return;
  chat.title = title.trim() || 'Untitled chat';
  chat.updatedAt = Date.now();
  await store('chats', 'readwrite', (s) => s.put(chat));
}

export async function touchChat(id: string): Promise<void> {
  const chat = await getChat(id);
  if (!chat) return;
  chat.updatedAt = Date.now();
  await store('chats', 'readwrite', (s) => s.put(chat));
}

export async function deleteChat(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['chats', 'messages'], 'readwrite');
    tx.objectStore('chats').delete(id);
    const messageIndex = tx.objectStore('messages').index('chatId');
    const request = messageIndex.openKeyCursor(IDBKeyRange.only(id));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        tx.objectStore('messages').delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const messages = await getAllFromIndex<Message>('messages', 'chatId', chatId);
  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addMessage(
  chatId: string,
  role: Message['role'],
  content: string,
  metadata: Pick<Message, 'model' | 'totalTokens'> = {},
): Promise<Message> {
  const message: Message = { id: uid('msg'), chatId, role, content, createdAt: Date.now(), ...metadata };
  await store('messages', 'readwrite', (s) => s.put(message));
  await touchChat(chatId);
  return message;
}

export async function updateMessage(message: Message): Promise<void> {
  await store('messages', 'readwrite', (s) => s.put(message));
  await touchChat(message.chatId);
}

export async function deleteMessagesAfter(chatId: string, createdAt: number): Promise<void> {
  const messages = await getMessages(chatId);
  const toDelete = messages.filter((message) => message.createdAt > createdAt);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const messagesStore = tx.objectStore('messages');
    for (const message of toDelete) messagesStore.delete(message.id);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
  await touchChat(chatId);
}

export async function getSettings(namespace: string): Promise<UserSettings> {
  const settings = await store<UserSettings | undefined>('settings', 'readonly', (s) => s.get(namespace));
  return {
    namespace,
    apiKey: settings?.apiKey ?? '',
    preset: settings?.preset ?? 'openrouter/auto',
  };
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await store('settings', 'readwrite', (s) => s.put(settings));
}

export async function getMeta(namespace: string): Promise<UserMeta> {
  const meta = await store<UserMeta | undefined>('meta', 'readonly', (s) => s.get(namespace));
  return meta ?? { namespace };
}

export async function setLastSentAt(namespace: string, lastSentAt: number): Promise<void> {
  await store('meta', 'readwrite', (s) => s.put({ namespace, lastSentAt }));
}

