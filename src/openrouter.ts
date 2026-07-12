import type { Message } from './types';

const FALLBACK_OPENROUTER_PRESET = 'openrouter/auto';

export async function requestReply(apiKey: string, preset: string, messages: Message[]): Promise<string> {
  const model = preset.trim() || FALLBACK_OPENROUTER_PRESET;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-OpenRouter-Title': 'OpenRouter Local UI',
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
  };
  return data.choices?.[0]?.message?.content?.trim() || 'No response content was returned.';
}
