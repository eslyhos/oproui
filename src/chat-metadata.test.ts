import { describe, expect, it } from 'vitest';
import { latestTotalTokens } from './chat-metadata';
import type { ChatMessage } from './types';

function message(role: ChatMessage['role'], totalTokens?: number): ChatMessage {
  return { id: crypto.randomUUID(), role, content: '', createdAt: 1, model: 'model/test', totalTokens };
}

describe('latestTotalTokens', () => {
  it('returns the latest assistant response total', () => {
    expect(latestTotalTokens([
      message('assistant', 100),
      message('user'),
      message('assistant', 455),
    ])).toBe(455);
  });

  it('reports unavailable when the latest assistant response has no usage', () => {
    expect(latestTotalTokens([message('assistant', 100), message('assistant')])).toBeUndefined();
    expect(latestTotalTokens([message('user')])).toBeUndefined();
  });
});
