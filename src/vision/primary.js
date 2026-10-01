// ==== FILEPATH: src/vision/primary.js ====
const fetch = require('node-fetch');

/**
 * Calls the configured Gemini model and returns a **strictly-typed** JSON object.
 * No extra text is permitted – the model must answer with pure JSON conforming
 * to the schema below.
 *
 * Expected shape:
 * {
 *   determinable: boolean,
 *   clues:        string[],
 *   confidence:   number,      // 0–1
 *   country:      string|null,
 *   state:        string|null,
 *   city:         string|null,
 *   place_name:   string|null
 * }
 */
async function analyzeImage(buffer, config) {
  const modelId = config.VISION_MODEL || config.visionModel || 'gemini-1.5-flash-latest';

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are a location-analysis assistant. Return ONLY a JSON object with the fields:
determinable (bool), clues (array of strings), confidence (0-1),
country (str|null), state (str|null), city (str|null), place_name (str|null).

Rules:
• Use ONLY visible evidence (landmarks, signage, architecture, vegetation,
  terrain, vehicles, road markings, etc.).
• Never invent missing evidence.
• If you cannot confidently decide, set determinable: false and provide clues.
• Output ONLY JSON – no markdown, no extra text.`,
          },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: buffer.toString('base64'),
            },
          },
        ],
      },
    ],
    generation_config: {
      temperature:       0,
      max_output_tokens: 512,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
      modelId
    )}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${txt}`);
  }

  const json    = await response.json();
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini');

  // Strip optional markdown code fences (```json … ```) that models sometimes add
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let result;
  try {
    result = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Invalid JSON from Gemini: ${e.message}\nRaw: ${cleaned.slice(0, 200)}`);
  }

  // Minimal validation – only the two fields that must always be present
  if (typeof result.determinable !== 'boolean' || !Array.isArray(result.clues)) {
    throw new Error('Missing required fields (determinable, clues) in Gemini response');
  }

  // Coerce optional nullable fields to null if absent
  result.country    = result.country    ?? null;
  result.state      = result.state      ?? null;
  result.city       = result.city       ?? null;
  result.place_name = result.place_name ?? null;
  result.confidence = typeof result.confidence === 'number' ? result.confidence : 0;

  return result;
}

module.exports = { analyzeImage };