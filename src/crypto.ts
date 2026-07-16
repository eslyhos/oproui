import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import type { UserVault, VaultEnvelope } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const VERSION = 1 as const;

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

export async function encryptVault(username: string, vault: UserVault): Promise<VaultEnvelope> {
  const namespace = await namespaceFor(username);
  const key = await digest('encryption-key', username);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const associatedData = encoder.encode(`OproUI:v${VERSION}:${namespace}`);
  const ciphertext = chacha20poly1305(key, nonce, associatedData).encrypt(encoder.encode(JSON.stringify(vault)));
  key.fill(0);
  return { namespace, version: VERSION, nonce: toBase64(nonce), ciphertext: toBase64(ciphertext) };
}

export async function decryptVault(username: string, envelope: VaultEnvelope): Promise<UserVault> {
  const namespace = await namespaceFor(username);
  if (envelope.version !== VERSION || envelope.namespace !== namespace) throw new Error('Stored data is unavailable or corrupt.');
  const key = await digest('encryption-key', username);
  try {
    const associatedData = encoder.encode(`OproUI:v${VERSION}:${namespace}`);
    const plaintext = chacha20poly1305(key, fromBase64(envelope.nonce), associatedData).decrypt(fromBase64(envelope.ciphertext));
    return JSON.parse(decoder.decode(plaintext)) as UserVault;
  } catch {
    throw new Error('Stored data is unavailable or corrupt.');
  } finally {
    key.fill(0);
  }
}
