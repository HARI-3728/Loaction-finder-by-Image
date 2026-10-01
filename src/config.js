// config.js - Environment variable validation and defaults
const dotenv = require('dotenv');
dotenv.config();

function required(name) {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

function int(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isNaN(v) ? fallback : v;
}

function bool(name, fallback) {
  const v = (process.env[name] || '').trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

const config = {
  // Required
  GEMINI_API_KEY: required('GEMINI_API_KEY'),
  VISION_MODEL: required('VISION_MODEL'),

  // Optional vision
  VISION_TIMEOUT_MS: int('VISION_TIMEOUT_MS', 20000),
  OPENROUTER_API_KEY: optional('OPENROUTER_API_KEY', ''),
  VISION_FALLBACK_MODEL: optional('VISION_FALLBACK_MODEL', ''),

  // Optional merge
  ENABLE_MERGE: bool('ENABLE_MERGE', false),
  MERGE_PROVIDER: optional('MERGE_PROVIDER', 'openrouter'),
  MERGE_MODEL: optional('MERGE_MODEL', ''),
  MERGE_TIMEOUT_MS: int('MERGE_TIMEOUT_MS', 15000),
  GROQ_API_KEY: optional('GROQ_API_KEY', ''),

  // Geocoding
  GEOCODER_USER_AGENT: optional('GEOCODER_USER_AGENT', 'image-location-finder'),
  GEOCODER_RATE_LIMIT_MS: int('GEOCODER_RATE_LIMIT_MS', 1000),

  // Pipeline
  USE_EXIF_GPS: bool('USE_EXIF_GPS', true),
  CONFIDENCE_THRESHOLD: parseFloat(optional('CONFIDENCE_THRESHOLD', '0.4')),
  MAX_UPLOAD_MB: int('MAX_UPLOAD_MB', 10),
  ALLOWED_IMAGE_TYPES: optional('ALLOWED_IMAGE_TYPES', 'image/jpeg,image/png,image/webp').split(',').map(s => s.trim()),

  // Server
  APP_PORT: int('APP_PORT', 3000),
};

module.exports = config;