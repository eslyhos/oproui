export type Role = 'user' | 'assistant';

export interface Chat {
  id: string;
  namespace: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  chatId: string;
  role: Role;
  content: string;
  createdAt: number;
  model?: string;
  totalTokens?: number;
}

export interface UserSettings {
  namespace: string;
  apiKey: string;
  preset: string;
}

export interface UserMeta {
  namespace: string;
  lastSentAt?: number;
}
