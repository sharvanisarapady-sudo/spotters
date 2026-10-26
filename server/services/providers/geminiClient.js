/**
 * Minimal Google Gemini client (no SDK; Node 18+ global fetch) using the generateContent REST method.
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *   header  x-goog-api-key: <key>          (header, never the query string, so it can't land in URLs/logs)
 *   body    { systemInstruction:{parts:[{text}]}, contents:[{role:'user',parts:[{text}]}],
 *             generationConfig:{ maxOutputTokens, responseMimeType:'application/json' } }
 *   reply   { candidates:[{content:{parts:[{text}]}, finishReason}], promptFeedback:{blockReason}, usageMetadata }
 *   errors  non-2xx with { error:{ code, message, status } }   (status e.g. INVALID_ARGUMENT, NOT_FOUND, RESOURCE_EXHAUSTED, UNAVAILABLE)
 *
 * Google's docs call generateContent "legacy but fully supported" (the newer Interactions API is the
 * recommended interface). Everything Gemini-specific lives in this file so it can be swapped.
 * Field names here come from the documented generateContent API; they were NOT exercised against the
 * live service in the sandbox where this was written. Test with your own key.
 *
 * Logging: status, Google error status string, duration and token counts only.
 * Never the API key, the student's answer, case text, or Google's free-text error message.
 */
const { ProviderError } = require('./providerError');

const BASE_URL = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/; // blocks path tricks in the URL

const timeoutMs = () => {
  const n = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 1000 ? n : 20000;
};

function kindForStatus(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status === 503 || status === 529) return 'overloaded';
  if (status === 400 || status === 413 || status === 422) return 'bad_request'; // Gemini also returns 400 for an invalid API key
  return 'server';
}
const retryable = (kind) => ['rate_limit', 'overloaded', 'server', 'timeout', 'network'].includes(kind);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function attempt({ apiKey, model, body, deadlineMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const started = Date.now();
  try {
    let res;
    try {
      res = await fetch(`${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new ProviderError(err.name === 'AbortError' ? 'timeout' : 'network', err.name === 'AbortError' ? 'request timed out' : 'network error');
    }

    let payload = null;
    try { payload = await res.json(); } catch { /* handled below */ }

    if (!res.ok) {
      const kind = kindForStatus(res.status);
      const hint = kind === 'not_found' ? ' (model not found or not available to this key - check AI_MODEL)' : kind === 'bad_request' ? ' (check AI_API_KEY and AI_MODEL)' : '';
      console.error(`[ai] gemini error http=${res.status} status=${payload?.error?.status || '-'} ms=${Date.now() - started}${hint}`);
      throw new ProviderError(kind, `HTTP ${res.status}`);
    }

    const blockReason = payload?.promptFeedback?.blockReason;
    const candidate = payload?.candidates?.[0];
    if (blockReason || candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
      console.error(`[ai] gemini response blocked block=${blockReason || candidate?.finishReason}`);
      throw new ProviderError('blocked', 'blocked by provider safety filter');
    }
    if (candidate?.finishReason === 'MAX_TOKENS') {
      console.error('[ai] gemini output truncated (MAX_TOKENS)');
      throw new ProviderError('bad_response', 'truncated');
    }

    // Skip "thought" parts if the model returns them; keep only answer text.
    const text = (candidate?.content?.parts || []).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
    if (!text.trim()) throw new ProviderError('bad_response', 'empty response');

    const u = payload.usageMetadata || {};
    console.log(`[ai] gemini ok ms=${Date.now() - started} in=${u.promptTokenCount ?? '?'} out=${u.candidatesTokenCount ?? '?'} finish=${candidate?.finishReason || '?'}`);
    return { text };
  } finally {
    clearTimeout(timer);
  }
}

/** Sends one message; retries once on transient failures if the time budget allows. */
async function createMessage({ apiKey, model, system, user, maxOutputTokens = 2048 }) {
  if (!apiKey) throw new ProviderError('config', 'AI_API_KEY is not set');
  if (!model) throw new ProviderError('config', 'AI_MODEL is not set');
  if (!MODEL_PATTERN.test(model)) throw new ProviderError('config', 'AI_MODEL has an invalid format');

  // No temperature/thinking settings on purpose: newer Gemini models ignore or restrict them, and
  // a generous maxOutputTokens leaves room for any internal "thinking" tokens on 2.5-era models.
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens, responseMimeType: 'application/json' },
  };
  const budget = timeoutMs();
  const start = Date.now();

  try {
    return await attempt({ apiKey, model, body, deadlineMs: budget });
  } catch (err) {
    const remaining = budget - (Date.now() - start) - 800;
    if (err instanceof ProviderError && retryable(err.kind) && remaining > 3000) {
      await sleep(800);
      return attempt({ apiKey, model, body, deadlineMs: remaining });
    }
    throw err;
  }
}

module.exports = { createMessage, ProviderError };
