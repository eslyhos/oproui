import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbForTests, saveSettings } from './db';
import { namespaceFor } from './crypto';

async function deleteDatabase(): Promise<void> {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('opro-ui');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe('vault persistence', () => {
  beforeEach(deleteDatabase);

  it('stores settings only inside the encrypted envelope', async () => {
    await saveSettings('RawUser', { apiKey: 'never-plaintext', preset: 'private-preset', model: 'private-model' });
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('opro-ui');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const namespace = await namespaceFor('RawUser');
    const raw = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction('vaults').objectStore('vaults').get(namespace);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const serialized = JSON.stringify(raw);
    expect(serialized).not.toContain('never-plaintext');
    expect(serialized).not.toContain('private-preset');
    expect(serialized).not.toContain('private-model');
    database.close();
  });
});
