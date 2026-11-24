import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import type { EncryptedValue } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digest(label: string, username: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`OproUI:${label}\0${username}`)));
}

export async function namespaceFor(username: string): Promise<string> {
  return toHex(await digest('namespace', username));
}

export async function encryptText(username: string, context: string, value: string): Promise<EncryptedValue> {
  const namespace = await namespaceFor(username);
  const key = await digest('encryption-key', username);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  try {
    const associatedData = encoder.encode(`OproUI:${namespace}:${context}`);
    const content = chacha20poly1305(key, nonce, associatedData).encrypt(encoder.encode(value));
    return { nonce: toBase64(nonce), content: toBase64(content) };
  } finally {
    key.fill(0);
  }
}

export async function decryptText(username: string, context: string, value: EncryptedValue): Promise<string> {
  const namespace = await namespaceFor(username);
  const key = await digest('encryption-key', username);
  try {
    const associatedData = encoder.encode(`OproUI:${namespace}:${context}`);
    const plaintext = chacha20poly1305(key, fromBase64(value.nonce), associatedData).decrypt(fromBase64(value.content));
    return decoder.decode(plaintext);
  } catch {
    throw new Error('Stored data is unavailable or corrupt.');
  } finally {
    key.fill(0);
  }
}
