export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  model: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface UserSettings {
  apiKey: string;
  preset: string;
  model: string;
}

export interface UserVault {
  settings: UserSettings;
  chats: Chat[];
}

export interface VaultEnvelope {
  namespace: string;
  version: 1;
  nonce: string;
  ciphertext: string;
}
