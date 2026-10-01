// src/merge.js — Optional LLM merge step
// Reconciles vision output with Nominatim result and returns corrected names.
// Usage: merge(visionResult, nominatimResult) → { country, state, city, place_name } or null

const config = require('./config');
const llm = require('./llm');

/**
 * Build the merge prompt.
 * @param {Object} vision — vision model output
 * @param {Object} geo — Nominatim result
 * @returns {string}
 */
function buildPrompt(vision, geo) {
  const address = geo.address || {};
  const parts = [
    vision.country ? `country: ${vision.country}` : 'country: null',
    vision.state ? `state: ${vision.state}` : 'state: null',
    vision.city ? `city: ${vision.city}` : 'city: null',
    vision.place_name ? `place_name: ${vision.place_name}` : 'place_name: null',
  ];
  const geoParts = [
    address.country ? `country: ${address.country}` : '',
    address.state ? `state: ${address.state}` : '',
    address.city || address.town || address.village ? `city: ${address.city || address.town || address.village}` : '',
    address.road ? `road: ${address.road}` : '',
    address.house_number ? `house_number: ${address.house_number}` : '',
  ].filter(Boolean);

  return `You are reconciling two location estimates for the same photo.

Vision model output: ${JSON.stringify({ country: parts[0], state: parts[1], city: parts[2], place_name: parts[3] })}
Nominatim reverse-geocode: ${JSON.stringify({ display_name: geo.display_name, address: geoParts })}

Return ONLY JSON:
{"country": string|null, "state": string|null, "city": string|null, "place_name": string|null, "confidence": 0-1}

Rules:
- Prefer the more specific source for each field. Nominatim is usually more accurate for country/state/city names.
- If they disagree, pick the one that matches the visible evidence (landmarks, signs, architecture).
- If you cannot reconcile, return the vision output unchanged.
- Never invent fields. If unsure, set the field to null.
- Return ONLY the JSON object, no markdown, no explanation.`;
}

/**
 * Merge vision output with Nominatim result using a Llama text model.
 * @param {Object} vision — vision model output
 * @param {Object} geo — Nominatim result
 * @returns {Promise<Object|null>} merged location or null on failure
 */
async function merge(vision, geo) {
  if (!config.ENABLE_MERGE) return null;

  const provider = config.MERGE_PROVIDER;
  const model = config.MERGE_MODEL;
  if (!model) {
    console.warn('[merge] MERGE_MODEL not set, skipping merge');
    return null;
  }

  const prompt = buildPrompt(vision, geo);
  const messages = [{ role: 'user', content: prompt }];

  try {
    const result = await llm.complete({
      provider,
      model,
      messages,
      temperature: 0,
      maxTokens: 256,
      timeoutMs: config.MERGE_TIMEOUT_MS,
    });

    const parsed = llm.parseJson(result.text);
    if (!parsed) {
      console.warn('[merge] Failed to parse merge response, keeping vision output');
      return null;
    }

    return {
      country: parsed.country || vision.country || null,
      state: parsed.state || vision.state || null,
      city: parsed.city || vision.city || null,
      place_name: parsed.place_name || vision.place_name || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : vision.confidence,
    };
  } catch (err) {
    console.warn('[merge] Merge failed, keeping vision output:', err.message);
    return null;
  }
}

/** Alias used by server.js */
const callMergeProvider = merge;

module.exports = { merge, callMergeProvider };