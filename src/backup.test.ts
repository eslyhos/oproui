import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendMessage,
  createChat,
  exportDatabaseBackup,
  getChat,
  getChats,
  getSettings,
  replaceDatabaseFromBackup,
  resetDbForTests,
  saveSettings,
} from './db';
import type { ChatMessage } from './types';

async function deleteDatabase(): Promise<void> {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('opro-ui');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function message(id: string, content: string, createdAt: number): ChatMessage {
  return { id, role: 'user', content, createdAt, model: 'model/test' };
}

describe('database backup', () => {
  beforeEach(deleteDatabase);

  it('round-trips every store and username namespace', async () => {
    await saveSettings('Alice', { apiKey: 'alice-key', preset: 'alice-preset', model: 'alice-model' });
    await saveSettings('Bob', { apiKey: 'bob-key', preset: '', model: 'bob-model' });
    const chat = await createChat('Alice', message('first', 'private first', 1));
    await appendMessage('Alice', chat.id, {
      ...message('second', 'private second', 2),
      role: 'assistant',
      reasoning: 'private reasoning',
      provider: 'Provider',
      totalTokens: 42,
    });

    const backup = await exportDatabaseBackup();
    expect(backup.settings).toHaveLength(2);
    expect(backup.chats).toHaveLength(1);
    expect(backup.messages).toHaveLength(2);
    expect(JSON.stringify(backup)).not.toContain('alice-key');
    expect(JSON.stringify(backup)).not.toContain('private first');

    await saveSettings('Extra', { apiKey: 'remove-me', preset: '', model: 'extra-model' });
    await replaceDatabaseFromBackup(JSON.parse(JSON.stringify(backup)));

    expect(await getSettings('Alice')).toEqual({ apiKey: 'alice-key', preset: 'alice-preset', model: 'alice-model' });
    expect(await getSettings('Bob')).toEqual({ apiKey: 'bob-key', preset: '', model: 'bob-model' });
    expect(await getSettings('Extra')).toEqual({ apiKey: '', preset: '', model: 'openrouter/auto' });
    expect((await getChat('Alice', chat.id))?.messages).toMatchObject([
      { content: 'private first' },
      { content: 'private second', reasoning: 'private reasoning', provider: 'Provider', totalTokens: 42 },
    ]);
  });

  it('waits for already queued writes before exporting', async () => {
    const pendingSave = saveSettings('Queued', { apiKey: 'queued-key', preset: '', model: 'queued-model' });
    const backup = await exportDatabaseBackup();
    await pendingSave;
    expect(backup.settings).toHaveLength(1);
    await replaceDatabaseFromBackup(JSON.parse(JSON.stringify(backup)));
    expect((await getSettings('Queued')).apiKey).toBe('queued-key');
  });

  it('rolls back replacement when imported keys conflict', async () => {
    await saveSettings('Existing', { apiKey: 'safe', preset: '', model: 'keep-model' });
    const chat = await createChat('Existing', message('one', 'keep chat', 1));
    const backup = await exportDatabaseBackup();
    backup.chats.push(structuredClone(backup.chats[0]));

    await expect(replaceDatabaseFromBackup(backup)).rejects.toBeTruthy();
    expect((await getSettings('Existing')).apiKey).toBe('safe');
    expect(await getChats('Existing')).toHaveLength(1);
    expect((await getChat('Existing', chat.id))?.messages[0].content).toBe('keep chat');
  });

});
