import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { appendMessage, createChat, editMessageAndTruncate, getChat, getChats, getSettings, resetDbForTests, saveSettings } from './db';
import { namespaceFor } from './crypto';
import type { ChatMessage } from './types';

async function deleteDatabase(): Promise<void> {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('opro-ui');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('opro-ui');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function rawRecords(storeName: string): Promise<unknown[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () => { database.close(); resolve(request.result); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

function message(id: string, content: string, createdAt: number): ChatMessage {
  return { id, role: 'user', content, createdAt, model: 'model/test' };
}

describe('per-record persistence', () => {
  beforeEach(deleteDatabase);

  it('stores only permitted settings fields in plaintext', async () => {
    await saveSettings('RawUser', { apiKey: 'never-plaintext', preset: 'private-preset', model: 'visible-model' });
    expect(await getSettings('RawUser')).toEqual({ apiKey: 'never-plaintext', preset: 'private-preset', model: 'visible-model' });
    const serialized = JSON.stringify(await rawRecords('settings'));
    expect(serialized).not.toContain('never-plaintext');
    expect(serialized).not.toContain('private-preset');
    expect(serialized).toContain('visible-model');
  });

  it('stores titles and each message in independent encrypted values', async () => {
    const chat = await createChat('User', message('first', 'private first', 1));
    await appendMessage('User', chat.id, { ...message('second', 'private second', 2), role: 'assistant' });
    expect(await getChat('User', chat.id)).toMatchObject({
      title: 'Untitled',
      messages: [{ content: 'private first' }, { content: 'private second' }],
    });
    expect(await getChats('User')).toEqual([{ id: chat.id, title: 'Untitled', createdAt: 1, updatedAt: 2 }]);
    const raw = JSON.stringify([...(await rawRecords('chats')), ...(await rawRecords('messages'))]);
    expect(raw).not.toContain('Untitled');
    expect(raw).not.toContain('private first');
    expect(raw).not.toContain('private second');
    expect(raw).toContain('model/test');
  });

  it('does not rewrite previous messages when appending', async () => {
    const chat = await createChat('User', message('first', 'one', 1));
    const before = JSON.stringify(await rawRecords('messages'));
    await appendMessage('User', chat.id, { ...message('second', 'two', 2), role: 'assistant' });
    const after = await rawRecords('messages') as Array<{ id: string }>;
    expect(JSON.stringify(after.filter((record) => record.id === 'first'))).toBe(before);
  });

  it('rewrites only an edited message and removes later messages', async () => {
    const chat = await createChat('User', message('first', 'one', 1));
    await appendMessage('User', chat.id, { ...message('second', 'two', 2), role: 'assistant' });
    await appendMessage('User', chat.id, message('third', 'three', 3));
    const before = await rawRecords('messages') as Array<{ id: string }>;
    const firstBefore = JSON.stringify(before.find((record) => record.id === 'first'));
    const secondBefore = JSON.stringify(before.find((record) => record.id === 'second'));
    await editMessageAndTruncate('User', chat.id, { ...message('second', 'edited', 2), role: 'assistant' }, 4);
    const after = await rawRecords('messages') as Array<{ id: string }>;
    expect(JSON.stringify(after.find((record) => record.id === 'first'))).toBe(firstBefore);
    expect(JSON.stringify(after.find((record) => record.id === 'second'))).not.toBe(secondBefore);
    expect(after.some((record) => record.id === 'third')).toBe(false);
    expect((await getChat('User', chat.id))?.messages.map((item) => item.content)).toEqual(['one', 'edited']);
  });

  it('separates users by namespace', async () => {
    await saveSettings('Alice', { apiKey: 'a', preset: '', model: 'm' });
    expect(await getSettings('alice')).toEqual({ apiKey: '', preset: '', model: 'openrouter/auto' });
    const records = await rawRecords('settings') as Array<{ namespace: string }>;
    expect(records[0].namespace).toBe(await namespaceFor('Alice'));
  });
});
