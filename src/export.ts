import type { Chat } from './types';

function pad(value: number): string { return String(value).padStart(2, '0'); }

export function formatLocalTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatChatExport(chat: Chat): string {
  return chat.messages.map((message) => {
    if (message.role === 'user') {
      return `[${formatLocalTimestamp(message.createdAt)}] [${message.role}] [${message.model}]\n\n[prompt]\n${message.content}`;
    }
    const reasoning = message.reasoning ? `[reasoning]\n${message.reasoning}\n\n--------------------\n\n` : '';
    return `[${formatLocalTimestamp(message.createdAt)}] [${message.role}] [${message.provider || 'Provider unknown'}] [${message.model}]\n\n${reasoning}[response]\n${message.content}`;
  }).join('\n\n----------------------------------------\n\n');
}

export function safeExportFilename(title: string): string {
  return `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'Untitled'}.txt`;
}
