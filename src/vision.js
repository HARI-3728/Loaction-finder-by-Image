// src/vision.js — Gemini vision + OpenRouter fallback
// Usage: analyzeImage(buffer, mimeType) → { determinable, country, state, city, place_name, confidence, clues }

const config = require('./config');
const { callGeminiVision } = require('./llm');

const VISION_PROMPT = `You are a geolocation vision model. Analyze this outdoor photo and estimate where it was taken.
Return ONLY a JSON object, no markdown, no extra text:
{
  "determinable": true|false,
  "country": string|null,
  "state": string|null,
  "city": string|null,
  "place_name": string|null,
  "confidence": number between 0 and 1,
  "clues": [string]
}

Rules:
- Use ONLY visible evidence: landmarks, signs and their script, architecture, vegetation, terrain, vehicles, road markings, clothing, lighting.
- If you see a landmark, name it in place_name.
- If evidence is weak or you are unsure, set determinable=false and confidence low.
- Never invent a country or city. If you cannot determine one, set it to null.
- confidence reflects how certain you are (0=not at all, 1=absolutely certain).
- clues should be 1-5 short observations that support your answer.
- If the image is indoors, blurry, or irrelevant, set determinable=false.
- If determinable is false, country/state/city/place_name should all be null and confidence should be < 0.3.
- Return ONLY the JSON object. No preamble, no explanation.`;

async function analyzeImage(buffer, mimeType) {
  const base64 = buffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64}`;

  // Try Gemini first
  try {
    const result = await callGeminiVision(dataUri, VISION_PROMPT);
    if (result) return normalizeResult(result, 'gemini');
  } catch (err) {
    console.warn('[vision] Gemini failed, trying fallback:', err.message);
  }

  // Fallback: OpenRouter Llama vision
  if (config.OPENROUTER_API_KEY && config.VISION_FALLBACK_MODEL) {
    try {
      const result = await callOpenRouterVision(dataUri, VISION_PROMPT);
      if (result) return normalizeResult(result, 'openrouter');
    } catch (err) {
      console.error('[vision] Fallback also failed:', err.message);
    }
  }

  throw new Error('All vision models failed');
}

async function callGeminiVision(dataUri, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.VISION_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: dataUri.match(/data:(.*?);/)?.[1] || 'image/jpeg', data: dataUri.split(',')[1] } }
      ]
    }],
    generation_config: { temperature: 0.1, max_output_tokens: 1024 }
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.VISION_TIMEOUT_MS)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gemini HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }

  const json = await resp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return extractJSON(text);
}

async function callOpenRouterVision(dataUri, prompt) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const body = {
    model: config.VISION_FALLBACK_MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUri } }
      ]
    }],
    max_tokens: 1024,
    temperature: 0.1
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://image-location-finder.local',
      'X-Title': 'Image Location Finder'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.VISION_TIMEOUT_MS)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }

  const json = await resp.json();
  const text = json?.choices?.[0]?.message?.content || '';
  return extractJSON(text);
}

function extractJSON(text) {
  if (!text) return null;
  // Try direct parse
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (_) {}
  return null;
}

function normalizeResult(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  const determinable = Boolean(raw.determinable);
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
  const country = raw.country ? String(raw.country).trim() : null;
  const state = raw.state ? String(raw.state).trim() : null;
  const city = raw.city ? String(raw.city).trim() : null;
  const place_name = raw.place_name ? String(raw.place_name).trim() : null;
  const clues = Array.isArray(raw.clues) ? raw.clues.map(String).slice(0, 5) : [];

  return {
    determinable,
    country: country || null,
    state: state || null,
    city: city || null,
    place_name: place_name || null,
    confidence,
    clues,
    source
  };
}

module.exports = { analyzeImage, VISION_PROMPT };