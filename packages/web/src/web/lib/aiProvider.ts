// AI provider abstraction — all providers via OpenAI-compatible SDK
import OpenAI from 'openai';
import type { AIProvider } from './storage';

// Base URLs for each provider's OpenAI-compatible endpoint
const BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
};

export function makeClient(provider: AIProvider, apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: BASE_URLS[provider],
    dangerouslyAllowBrowser: true,
    defaultHeaders:
      provider === 'anthropic'
        ? { 'anthropic-version': '2023-06-01' }
        : undefined,
  });
}

// ── Model lists ───────────────────────────────────────────────────────────────

export async function fetchModels(provider: AIProvider, apiKey: string): Promise<string[]> {
  try {
    switch (provider) {
      case 'openai':    return await fetchOpenAIModels(apiKey);
      case 'anthropic': return await fetchAnthropicModels(apiKey);
      case 'gemini':    return await fetchGeminiModels(apiKey);
    }
  } catch {
    return fallbackModels(provider);
  }
}

// OpenAI — GET https://api.openai.com/v1/models
async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body?.error?.message || `HTTP ${res.status}`), { status: res.status });
  }
  const data = await res.json() as { data: { id: string }[] };
  const ids = data.data
    .map((m) => m.id)
    .filter((id) =>
      /^(gpt-|o1|o3|o4|chatgpt)/.test(id) &&
      !/(audio|realtime|tts|transcribe|search|image|vision|instruct)/i.test(id),
    )
    .sort((a, b) => {
      const rank = (s: string) => {
        if (s.startsWith('gpt-4o')) return 0;
        if (s.startsWith('gpt-4.1')) return 1;
        if (s.startsWith('gpt-4')) return 2;
        if (s.startsWith('gpt-3')) return 3;
        if (s.startsWith('o')) return 4;
        return 5;
      };
      return rank(a) - rank(b) || a.localeCompare(b);
    });
  return ids.length > 0 ? ids : fallbackModels('openai');
}

// Anthropic — GET https://api.anthropic.com/v1/models
// NOTE: Anthropic blocks browser CORS. We use their native REST endpoint directly
// and handle the CORS limitation gracefully by falling back to known models.
async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body?.error?.message || `HTTP ${res.status}`), { status: res.status });
  }
  const data = await res.json() as { data: { id: string }[] };
  const ids = (data.data ?? [])
    .map((m) => m.id)
    .filter((id) => id.startsWith('claude-'))
    .sort((a, b) => {
      const tierScore = (s: string) => {
        if (s.includes('opus')) return 0;
        if (s.includes('sonnet')) return 1;
        if (s.includes('haiku')) return 2;
        return 3;
      };
      return tierScore(a) - tierScore(b) || b.localeCompare(a);
    });
  return ids.length > 0 ? ids : fallbackModels('anthropic');
}

// Gemini — GET https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY
async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body?.error?.message || `HTTP ${res.status}`), { status: res.status });
  }
  const data = await res.json() as {
    models: { name: string; supportedGenerationMethods: string[] }[];
  };
  const ids = (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => id.startsWith('gemini-') && !/embedding|tts|vision|image/i.test(id))
    .sort((a, b) => {
      const ver = (s: string) => {
        const m = s.match(/gemini-(\d+\.\d+)/);
        return m ? -parseFloat(m[1]) : 0;
      };
      return ver(a) - ver(b) || a.localeCompare(b);
    });
  return ids.length > 0 ? ids : fallbackModels('gemini');
}

// ── Test connection ───────────────────────────────────────────────────────────
// Uses native fetch per-provider to avoid OpenAI SDK's "Connection error." swallowing.
// Returns { ok, message } — never throws.

export async function testConnection(
  provider: AIProvider,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; message: string; statusCode?: number }> {
  try {
    switch (provider) {
      case 'openai':    return await testOpenAI(apiKey, model);
      case 'anthropic': return await testAnthropic(apiKey, model);
      case 'gemini':    return await testGemini(apiKey, model);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork = /fetch|network|failed to|CORS|blocked/i.test(msg);
    return {
      ok: false,
      message: isNetwork
        ? 'Network error — check your internet connection or try a different model.'
        : msg,
    };
  }
}

async function testOpenAI(
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; message: string; statusCode?: number }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
      max_tokens: 5,
    }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const err = (body as { error?: { message?: string } })?.error;
    return { ok: false, message: err?.message || `HTTP ${res.status}`, statusCode: res.status };
  }
  const reply = (body as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content?.trim() || '';
  return { ok: true, message: `${reply || 'OK'} ✓` };
}

async function testAnthropic(
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; message: string; statusCode?: number }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
    }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const err = (body as { error?: { message?: string } })?.error;
    return { ok: false, message: err?.message || `HTTP ${res.status}`, statusCode: res.status };
  }
  const reply = ((body as {
    content?: { type: string; text: string }[]
  })?.content ?? []).find((c) => c.type === 'text')?.text?.trim() || '';
  return { ok: true, message: `${reply || 'OK'} ✓` };
}

async function testGemini(
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; message: string; statusCode?: number }> {
  // Use native Gemini REST (not OpenAI-compat) for test — more reliable
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "OK" in one word.' }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    },
  );
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const err = (body as { error?: { message?: string } })?.error;
    return { ok: false, message: err?.message || `HTTP ${res.status}`, statusCode: res.status };
  }
  const reply = ((body as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  })?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '').join('').trim();
  return { ok: true, message: `${reply || 'OK'} ✓` };
}

// ── Anthropic native-fetch chat completion ────────────────────────────────────
// Anthropic blocks CORS from browsers, so the OpenAI SDK path fails with
// "Connection error." We send the request natively and parse the response.

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export async function anthropicChatCompletion(
  apiKey: string,
  model: string,
  messages: AnthropicMessage[],
  maxTokens = 500,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const errMsg = (body?.error as { message?: string } | undefined)?.message || `HTTP ${res.status}`;
    const e = new Error(errMsg) as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  const content = (body as { content?: { type: string; text: string }[] })?.content ?? [];
  return content.find((c) => c.type === 'text')?.text?.trim() ?? '';
}

// ── Gemini native-fetch chat completion ───────────────────────────────────────
// Uses the native generateContent REST endpoint directly.
// Supports both text and image (inline_data) content parts.

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export async function geminiChatCompletion(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  maxTokens = 500,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    },
  );
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const errMsg = (body?.error as { message?: string } | undefined)?.message || `HTTP ${res.status}`;
    const e = new Error(errMsg) as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  const candidates = (body as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  })?.candidates ?? [];
  const text = (candidates[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  return text;
}

// ── Fallback (offline / key error) ───────────────────────────────────────────

function fallbackModels(provider: AIProvider): string[] {
  switch (provider) {
    case 'openai':
      return [
        'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
        'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo',
        'o1', 'o1-mini', 'o3', 'o3-mini', 'o4-mini',
      ];
    case 'anthropic':
      return [
        'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5',
        'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307',
      ];
    case 'gemini':
      return [
        'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite',
        'gemini-2.0-flash', 'gemini-2.0-flash-lite',
        'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b',
      ];
  }
}
