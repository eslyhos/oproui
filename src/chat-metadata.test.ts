import { describe, expect, it } from 'vitest';
import { accumulatedTotalTokens } from './chat-metadata';
import type { ChatMessage } from './types';

function message(role: ChatMessage['role'], totalTokens?: number): ChatMessage {
  return { id: crypto.randomUUID(), role, content: '', createdAt: 1, model: 'model/test', totalTokens };
}

describe('accumulatedTotalTokens', () => {
  it('adds token totals from every assistant response', () => {
    expect(accumulatedTotalTokens([
      message('assistant', 100),
      message('user'),
      message('assistant', 455),
    ])).toBe(555);
  });

  it('ignores assistant responses without usage and user metadata', () => {
    expect(accumulatedTotalTokens([
      message('assistant', 100),
      message('assistant'),
      message('user', 999),
    ])).toBe(100);
  });

  it('reports unavailable when no assistant response has usage', () => {
    expect(accumulatedTotalTokens([message('assistant'), message('user')])).toBeUndefined();
  });
});
