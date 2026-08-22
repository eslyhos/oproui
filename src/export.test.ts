import { describe, expect, it, vi } from 'vitest';
import { formatChatExport, formatLocalTimestamp, safeExportFilename } from './export';
import type { Chat } from './types';

describe('chat export', () => {
  it('uses the exact transcript format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 16, 10, 5));
    const timestamp = Date.now();
    const chat: Chat = {
      id: '1', title: 'Untitled', createdAt: timestamp, updatedAt: timestamp,
      messages: [
        { id: 'u', role: 'user', model: 'model/a', content: 'Hello', createdAt: timestamp },
        {
          id: 'a', role: 'assistant', provider: 'AtlasCloud', model: 'model/b',
          reasoning: 'Thinking\ncarefully', content: 'Hi\nthere', createdAt: timestamp,
        },
      ],
    };
    expect(formatChatExport(chat)).toBe(
      '[2026-07-16 10:05] [user] [model/a]\n\n[prompt]\nHello\n\n' +
      '----------------------------------------\n\n' +
      '[2026-07-16 10:05] [assistant] [AtlasCloud] [model/b]\n\n' +
      '[reasoning]\nThinking\ncarefully\n\n--------------------\n\n[response]\nHi\nthere',
    );
    vi.useRealTimers();
  });

  it('sanitizes filenames', () => {
    expect(safeExportFilename('bad:name/')).toBe('bad_name_.txt');
    expect(safeExportFilename('')).toBe('Untitled.txt');
  });

  it('labels legacy assistant responses and uses an unknown provider fallback', () => {
    const chat: Chat = {
      id: '1', title: 'Legacy', createdAt: 0, updatedAt: 0,
      messages: [{ id: 'a', role: 'assistant', model: 'model/a', content: 'Hi', createdAt: 0 }],
    };
    const output = formatChatExport(chat);
    expect(output).toBe(`[${formatLocalTimestamp(0)}] [assistant] [Provider unknown] [model/a]\n\n[response]\nHi`);
    expect(output).not.toContain('[reasoning]');
  });
});
