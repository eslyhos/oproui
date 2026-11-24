import type { ChatMessage } from './types';

export function accumulatedTotalTokens(messages: ChatMessage[]): number | undefined {
  const totals = messages
    .filter((message) => message.role === 'assistant' && message.totalTokens !== undefined)
    .map((message) => message.totalTokens as number);
  return totals.length ? totals.reduce((sum, total) => sum + total, 0) : undefined;
}
