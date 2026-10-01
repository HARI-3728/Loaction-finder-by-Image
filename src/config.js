// ==== FILEPATH: src/config.js ====
/*
 * Central configuration loader.
 *
 * • Reads from process.env (populated by dotenv in server.js before this runs).
 * • Applies safe defaults for all optional fields.
 * • Throws on missing required keys so misconfigured deployments fail fast.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Required keys – throw immediately if absent (empty string counts as missing)
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const VISION_MODEL   = process.env.VISION_MODEL   || '';

if (!GEMINI_API_KEY) {
  throw new Error(
    'GEMINI_API_KEY is required. Set it in your .env file or environment before starting.'
  );
}
if (!VISION_MODEL) {
  throw new Error(
    'VISION_MODEL is required. Set it in your .env file (e.g. gemini-1.5-flash-latest).'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional settings with typed defaults
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  // ── Core ──────────────────────────────────────────────────────────────────
  GEMINI_API_KEY,
  VISION_MODEL,

  // ── Fallback / OpenRouter ──────────────────────────────────────────────────
  OPENROUTER_API_KEY:    process.env.OPENROUTER_API_KEY    || '',
  VISION_FALLBACK_MODEL: process.env.VISION_FALLBACK_MODEL || '',

  // ── Timeouts ───────────────────────────────────────────────────────────────
  VISION_TIMEOUT_MS:     parseInt(process.env.VISION_TIMEOUT_MS, 10) || 20000,
  MERGE_TIMEOUT_MS:      parseInt(process.env.MERGE_TIMEOUT_MS,  10) || 15000,
  OCR_TIMEOUT_MS:        parseInt(process.env.OCR_TIMEOUT_MS,    10) || 5000,

  // ── Pipeline behaviour ─────────────────────────────────────────────────────
  CONFIDENCE_THRESHOLD:  parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.4,
  MAX_UPLOAD_MB:         parseInt(process.env.MAX_UPLOAD_MB, 10)      || 10,
  ALLOWED_IMAGE_TYPES:   (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(','),
  USE_EXIF_GPS:          process.env.USE_EXIF_GPS !== 'false',   // default true

  // ── Merge step ────────────────────────────────────────────────────────────
  ENABLE_MERGE:    process.env.ENABLE_MERGE === 'true',           // default false
  MERGE_PROVIDER:  process.env.MERGE_PROVIDER || 'openrouter',
  MERGE_MODEL:     process.env.MERGE_MODEL    || '',
  GROQ_API_KEY:    process.env.GROQ_API_KEY   || '',

  // ── Geocoding ─────────────────────────────────────────────────────────────
  GEOCODER_USER_AGENT:    process.env.GEOCODER_USER_AGENT    || 'image-location-finder',
  GEOCODER_RATE_LIMIT_MS: parseInt(process.env.GEOCODER_RATE_LIMIT_MS, 10) || 1000,

  // ── Server ────────────────────────────────────────────────────────────────
  APP_PORT: parseInt(process.env.APP_PORT, 10) || 3000,

  // ── Rate-limit ────────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  RATE_LIMIT_MAX:       parseInt(process.env.RATE_LIMIT_MAX,        10) || 10,

  // ── Evidence scoring weights ───────────────────────────────────────────────
  WEIGHT_GPS:              parseFloat(process.env.WEIGHT_GPS)              || 1.0,
  WEIGHT_OCR:              parseFloat(process.env.WEIGHT_OCR)              || 1.0,
  WEIGHT_LANDMARK:         parseFloat(process.env.WEIGHT_LANDMARK)         || 1.0,
  WEIGHT_VISION_AGREEMENT: parseFloat(process.env.WEIGHT_VISION_AGREEMENT) || 1.0,

  // ── OCR (future) ──────────────────────────────────────────────────────────
  OCR_PROVIDER: process.env.OCR_PROVIDER || '',

  // ── Debug ─────────────────────────────────────────────────────────────────
  DEBUG_PIPELINE: process.env.DEBUG_PIPELINE === 'true',
};

module.exports = CONFIG;