import { describe, expect, it } from 'vitest';
import { decryptText, encryptText, namespaceFor } from './crypto';

describe('encrypted values', () => {
  it('round trips without exposing plaintext', async () => {
    const encrypted = await encryptText('Alice', 'message:1:1:content', 'private text');
    expect(JSON.stringify(encrypted)).not.toContain('private text');
    expect(await decryptText('Alice', 'message:1:1:content', encrypted)).toBe('private text');
  });

  it('uses random nonces and case-sensitive namespaces', async () => {
    const first = await encryptText('Alice', 'settings:apiKey', 'same');
    const second = await encryptText('Alice', 'settings:apiKey', 'same');
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.content).not.toBe(second.content);
    expect(await namespaceFor('Alice')).not.toBe(await namespaceFor('alice'));
  });

  it('rejects tampering, the wrong username, and a different context', async () => {
    const encrypted = await encryptText('Alice', 'settings:apiKey', 'secret');
    await expect(decryptText('Bob', 'settings:apiKey', encrypted)).rejects.toThrow('unavailable or corrupt');
    await expect(decryptText('Alice', 'settings:preset', encrypted)).rejects.toThrow('unavailable or corrupt');
    const tampered = { ...encrypted, content: `${encrypted.content.slice(0, -2)}AA` };
    await expect(decryptText('Alice', 'settings:apiKey', tampered)).rejects.toThrow('unavailable or corrupt');
  });
});
