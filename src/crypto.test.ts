import { describe, expect, it } from 'vitest';
import { decryptVault, encryptVault, namespaceFor } from './crypto';
import type { UserVault } from './types';

const vault: UserVault = {
  settings: { apiKey: 'secret-key', preset: 'my-preset', model: 'openai/test' },
  chats: [{ id: '1', title: 'Private title', createdAt: 1, updatedAt: 2, messages: [] }],
};

describe('encrypted vault', () => {
  it('round trips without exposing plaintext', async () => {
    const envelope = await encryptVault('Alice', vault);
    expect(JSON.stringify(envelope)).not.toContain('secret-key');
    expect(JSON.stringify(envelope)).not.toContain('Private title');
    expect(await decryptVault('Alice', envelope)).toEqual(vault);
  });

  it('uses random nonces and case-sensitive namespaces', async () => {
    const first = await encryptVault('Alice', vault);
    const second = await encryptVault('Alice', vault);
    expect(first.nonce).not.toBe(second.nonce);
    expect(await namespaceFor('Alice')).not.toBe(await namespaceFor('alice'));
  });

  it('rejects tampering and the wrong username', async () => {
    const envelope = await encryptVault('Alice', vault);
    await expect(decryptVault('Bob', envelope)).rejects.toThrow('unavailable or corrupt');
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`;
    await expect(decryptVault('Alice', envelope)).rejects.toThrow('unavailable or corrupt');
  });
});
