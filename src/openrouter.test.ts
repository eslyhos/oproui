import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestReply } from './openrouter';

const settings = { apiKey: 'key', preset: '', model: 'openrouter/auto' };
const messages = [{ id: '1', role: 'user' as const, content: 'Hello', createdAt: 1, model: 'openrouter/auto' }];

afterEach(() => vi.unstubAllGlobals());

describe('requestReply metadata', () => {
  it('returns provider, reasoning, and total tokens from the completion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Response text', reasoning: 'Reasoning text' } }],
      model: 'deepseek/deepseek-v4-flash',
      provider: 'AtlasCloud',
      usage: { total_tokens: 455 },
    }), { status: 200 })));

    await expect(requestReply(settings, messages)).resolves.toEqual({
      content: 'Response text',
      model: 'deepseek/deepseek-v4-flash',
      provider: 'AtlasCloud',
      reasoning: 'Reasoning text',
      totalTokens: 455,
    });
  });

  it('keeps a valid response when optional metadata is missing or malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Hi', reasoning: 123 } }],
      provider: '',
      usage: { total_tokens: -1 },
    }), { status: 200 })));

    await expect(requestReply(settings, messages)).resolves.toEqual({
      content: 'Hi',
      model: 'openrouter/auto',
      provider: undefined,
      reasoning: undefined,
      totalTokens: undefined,
    });
  });
});
