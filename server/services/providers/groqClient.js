const { ProviderError } = require('./providerError');

const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

const timeoutMs = () => {
  const n = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 1000 ? n : 20000;
};

function kindForStatus(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status === 503 || status === 529) return 'overloaded';
  if ([400, 413, 422].includes(status)) return 'bad_request';
  return 'server';
}

const retryable = (kind) =>
  ['rate_limit', 'overloaded', 'server', 'timeout', 'network'].includes(kind);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt({ apiKey, model, system, user, deadlineMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const started = Date.now();

  try {
    let response;

    try {
      response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_completion_tokens: 1200,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new ProviderError(
        err.name === 'AbortError' ? 'timeout' : 'network',
        err.name === 'AbortError' ? 'request timed out' : 'network error'
      );
    }

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      // Invalid responses are handled below.
    }

    if (!response.ok) {
      const kind = kindForStatus(response.status);

      console.error(
        `[ai] groq error http=${response.status} ms=${Date.now() - started}`
      );

      throw new ProviderError(kind, `HTTP ${response.status}`);
    }

    const text = payload?.choices?.[0]?.message?.content;

    if (typeof text !== 'string' || !text.trim()) {
      throw new ProviderError('bad_response', 'empty response');
    }

    console.log(`[ai] groq ok ms=${Date.now() - started}`);

    return { text };
  } finally {
    clearTimeout(timer);
  }
}

async function createMessage({ apiKey, model, system, user }) {
  if (!apiKey) {
    throw new ProviderError('config', 'AI_API_KEY is not set');
  }

  if (!model) {
    throw new ProviderError('config', 'AI_MODEL is not set');
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,100}$/.test(model)) {
    throw new ProviderError('config', 'AI_MODEL has an invalid format');
  }

  const budget = timeoutMs();
  const started = Date.now();

  try {
    return await attempt({
      apiKey,
      model,
      system,
      user,
      deadlineMs: budget,
    });
  } catch (err) {
    const remaining = budget - (Date.now() - started) - 800;

    if (
      err instanceof ProviderError &&
      retryable(err.kind) &&
      remaining > 3000
    ) {
      await sleep(800);

      return attempt({
        apiKey,
        model,
        system,
        user,
        deadlineMs: remaining,
      });
    }

    throw err;
  }
}

module.exports = { createMessage, ProviderError };