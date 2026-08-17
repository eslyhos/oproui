import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendMessage,
  createChat,
  exportDatabaseBackup,
  getChat,
  getChats,
  getSettings,
  importDatabaseBackup,
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

  it('exports chats without settings and imports every username namespace', async () => {
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
    expect(backup).not.toHaveProperty('settings');
    expect(backup.chats).toHaveLength(1);
    expect(backup.messages).toHaveLength(2);
    expect(JSON.stringify(backup)).not.toContain('alice-key');
    expect(JSON.stringify(backup)).not.toContain('private first');

    await saveSettings('Alice', { apiKey: 'changed', preset: '', model: 'changed-model' });
    await importDatabaseBackup({ ...JSON.parse(JSON.stringify(backup)), settings: [{ namespace: 'ignored' }] });

    expect(await getSettings('Alice')).toEqual({ apiKey: 'changed', preset: '', model: 'changed-model' });
    expect(await getSettings('Bob')).toEqual({ apiKey: 'bob-key', preset: '', model: 'bob-model' });
    expect((await getChat('Alice', chat.id))?.messages).toMatchObject([
      { content: 'private first' },
      { content: 'private second', reasoning: 'private reasoning', provider: 'Provider', totalTokens: 42 },
    ]);
  });

  it('waits for already queued writes before exporting', async () => {
    const pendingSave = saveSettings('Queued', { apiKey: 'queued-key', preset: '', model: 'queued-model' });
    const backup = await exportDatabaseBackup();
    await pendingSave;
    expect(backup).not.toHaveProperty('settings');
    await importDatabaseBackup(JSON.parse(JSON.stringify(backup)));
    expect((await getSettings('Queued')).apiKey).toBe('queued-key');
  });

  it('replaces a matching chat completely and keeps unrelated chats', async () => {
    await saveSettings('Existing', { apiKey: 'safe', preset: '', model: 'keep-model' });
    const replaced = await createChat('Existing', message('one', 'backup message', 1));
    const backup = await exportDatabaseBackup();
    await appendMessage('Existing', replaced.id, message('old-extra', 'must be removed', 2));
    const unrelated = await createChat('Existing', message('unrelated', 'keep chat', 3));

    await importDatabaseBackup(backup);

    expect((await getSettings('Existing')).apiKey).toBe('safe');
    expect(await getChats('Existing')).toHaveLength(2);
    expect((await getChat('Existing', replaced.id))?.messages.map((item) => item.content)).toEqual(['backup message']);
    expect((await getChat('Existing', unrelated.id))?.messages[0].content).toBe('keep chat');
  });

  it('ignores orphaned messages', async () => {
    const chat = await createChat('Existing', message('one', 'backup message', 1));
    const backup = await exportDatabaseBackup();
    backup.messages.push({ ...structuredClone(backup.messages[0]), chatId: 'missing-chat', id: 'orphan' });

    await importDatabaseBackup(backup);

    expect((await getChat('Existing', chat.id))?.messages).toHaveLength(1);
  });

  it('rolls back the import when incoming message positions conflict', async () => {
    const existing = await createChat('Existing', message('one', 'keep chat', 1));
    const backup = await exportDatabaseBackup();
    backup.chats[0] = { ...backup.chats[0], id: 'new-chat' };
    backup.messages = backup.messages.map((item) => ({ ...item, chatId: 'new-chat' }));
    backup.messages.push({ ...structuredClone(backup.messages[0]), id: 'duplicate-position' });

    await expect(importDatabaseBackup(backup)).rejects.toBeTruthy();
    expect(await getChat('Existing', 'new-chat')).toBeUndefined();
    expect((await getChat('Existing', existing.id))?.messages[0].content).toBe('keep chat');
  });

});
