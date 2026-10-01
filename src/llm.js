// src/llm.js — LLM helper: OpenAI-compatible API calls (OpenRouter / Groq)
// Usage: complete({ provider, model, messages, temperature, maxTokens, timeoutMs }) → { text }
//        parseJson(text) → Object | null

const config = require('./config');

const PROVIDERS = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: () => config.OPENROUTER_API_KEY,
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: () => config.GROQ_API_KEY,
  },
};

/**
 * Call an OpenAI-compatible chat completions endpoint.
 * @param {Object} opts
 * @param {string} opts.provider — 'openrouter' | 'groq'
 * @param {string} opts.model
 * @param {Array} opts.messages
 * @param {number} opts.temperature
 * @param {number} opts.maxTokens
 * @param {number} opts.timeoutMs
 * @returns {Promise<{ text: string }>}
 */
async function complete({ provider, model, messages, temperature = 0, maxTokens = 512, timeoutMs = 20000 }) {
  const prov = PROVIDERS[provider];
  if (!prov) {
    throw new Error(`Unknown LLM provider: ${provider}`);
  }
  const apiKey = prov.apiKey();
  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }

  const url = `${prov.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(provider === 'openrouter' && {
          'HTTP-Referer': 'https://image-location-finder.local',
          'X-Title': 'Image Location Finder',
        }),
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error(`${provider} timeout`);
    throw err;
  }
  clearTimeout(timeout);

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${provider} HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error(`${provider} returned no content`);
  }
  return { text };
}

/**
 * Parse JSON from a string, handling markdown code fences.
 * @param {string} text
 * @returns {Object|null}
 */
function parseJson(text) {
  if (typeof text !== 'string') return null;

  // Try direct parse
  try {
    return JSON.parse(text);
  } catch (_) {}

  // Try extracting from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (_) {}
  }

  // Try finding the first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch (_) {}
  }

  return null;
}

module.exports = { complete, parseJson };