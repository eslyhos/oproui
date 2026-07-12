import type { Message } from './types';

const FALLBACK_OPENROUTER_PRESET = 'openrouter/auto';

export interface OpenRouterReply {
  content: string;
  model?: string;
  totalTokens?: number;
}

export async function requestReply(apiKey: string, preset: string, messages: Message[]): Promise<OpenRouterReply> {
  const model = preset.trim() || FALLBACK_OPENROUTER_PRESET;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OpenRouter request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { total_tokens?: number };
  };
  return {
    content: data.choices?.[0]?.message?.content?.trim() || 'No response content was returned.',
    model: data.model,
    totalTokens: data.usage?.total_tokens,
  };
}
