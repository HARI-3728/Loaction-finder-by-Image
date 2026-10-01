const { analyzeImage } = require('./primary');
const { callFallbackVision } = require('./fallback');

/**
 * Centralised entry point used by the back‑end.
 * It first tries the primary model (Gemini) and on any error falls back
 * to the Llama model via OpenRouter, if configured.
 *
 * @param {Buffer} buffer        – raw image buffer from the upload
 * @param {Object} config        – the full config object (env variables)
 * @returns {Promise<Object>}    – the validated vision result
 * @throws {Error}               – when *all* vision providers fail
 */
async function callVision(buffer, config) {
  // ---- 1️⃣ Try primary (Gemini) ----
  try {
    return await analyzeImage(buffer, {
      visionModel: config.VISION_MODEL,
      visionTimeoutMs: config.VISION_TIMEOUT_MS,
    });
  } catch (primaryErr) {
    console.warn('Primary vision failed – attempting fallback:', primaryErr.message);
  }

  // ---- 2️⃣ Fallback (OpenRouter) ----
  if (
    config.OPENROUTER_API_KEY &&
    config.VISION_FALLBACK_MODEL
  ) {
    try {
      return await callFallbackVision(buffer, config);
    } catch (fallbackErr) {
      console.warn('Fallback vision also failed:', fallbackErr.message);
    }
  }

  // ---- 3️⃣ All attempts exhausted ----
  throw new Error('All vision providers failed');
}

module.exports = { callVision };