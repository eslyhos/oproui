import type { ChatMessage, UserSettings } from './types';

export interface OpenRouterReply {
  content: string;
  model: string;
  provider?: string;
  reasoning?: string;
  totalTokens?: number;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: unknown; reasoning?: unknown } }>;
  model?: unknown;
  provider?: unknown;
  usage?: { total_tokens?: unknown };
}

function errorText(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') return error.message;
  }
  return fallback;
}

export async function requestReply(settings: UserSettings, messages: ChatMessage[]): Promise<OpenRouterReply> {
  const body: { model: string; messages: Array<{ role: string; content: string }>; preset?: string } = {
    model: settings.model,
    messages: messages.map(({ role, content }) => ({ role, content })),
  };
  if (settings.preset.trim()) body.preset = settings.preset.trim();
  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'OproUI' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Network request failed.');
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = undefined; }
  if (!response.ok) throw new Error(errorText(payload, `OpenRouter request failed (${response.status}).`));
  const data = payload as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('OpenRouter returned an empty or malformed response.');
  const rawReasoning = data.choices?.[0]?.message?.reasoning;
  const provider = typeof data.provider === 'string' && data.provider.trim() ? data.provider.trim() : undefined;
  const reasoning = typeof rawReasoning === 'string' && rawReasoning.trim() ? rawReasoning.trim() : undefined;
  const totalTokens = typeof data.usage?.total_tokens === 'number'
    && Number.isFinite(data.usage.total_tokens)
    && data.usage.total_tokens >= 0
    ? data.usage.total_tokens
    : undefined;
  return {
    content: content.trim(),
    model: typeof data.model === 'string' && data.model ? data.model : settings.model,
    provider,
    reasoning,
    totalTokens,
  };
}
