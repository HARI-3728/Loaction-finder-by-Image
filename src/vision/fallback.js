const fetch = require('node-fetch');

/**
 * Calls the Llama vision model on OpenRouter as a fallback when the primary
 * Gemini call fails. The returned JSON must match the schema used by
 * `primary.js`.
 */
async function callFallbackVision(buffer, config) {
  const payload = {
    model: config.VISION_FALLBACK_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are a location‑analysis assistant. Return ONLY a JSON object with the same schema
            as the primary model (determinable, clues, confidence, country, state, city, place_name).
            Use only visible evidence. Do NOT invent a location.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${buffer.toString('base64')}`,
            },
          },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0,
    response_format: { type: 'json_object' },
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://image-location-finder.local',
      'X-Title': 'Image Location Finder',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    timeout: config.VISION_TIMEOUT_MS ?? 20000,
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${txt}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');

  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON from fallback: ${e.message}`);
  }
}

module.exports = { callFallbackVision };