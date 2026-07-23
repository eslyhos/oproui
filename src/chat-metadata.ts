import type { ChatMessage } from './types';

export function latestTotalTokens(messages: ChatMessage[]): number | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') return messages[index].totalTokens;
  }
  return undefined;
}
