// test/test-config.test.js — Tests for config validation
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// We test config.js by temporarily manipulating process.env
// Load config fresh each time by clearing require cache
function loadConfig() {
  delete require.cache[require.resolve('../src/config')];
  return require('../src/config');
}

describe('config validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, originalEnv);
  });

  it('throws if GEMINI_API_KEY is missing', () => {
    process.env.GEMINI_API_KEY = '';
    process.env.VISION_MODEL = 'gemini-1.5-flash-latest';
    assert.throws(() => loadConfig(), /GEMINI_API_KEY/);
  });

  it('throws if VISION_MODEL is missing', () => {
    process.env.GEMINI_API_KEY = 'key123';
    process.env.VISION_MODEL = '';
    assert.throws(() => loadConfig(), /VISION_MODEL/);
  });

  it('returns defaults for optional fields', () => {
    process.env.GEMINI_API_KEY = 'key123';
    process.env.VISION_MODEL = 'gemini-1.5-flash-latest';
    const cfg = loadConfig();
    assert.equal(cfg.VISION_TIMEOUT_MS, 20000);
    assert.equal(cfg.CONFIDENCE_THRESHOLD, 0.4);
    assert.equal(cfg.MAX_UPLOAD_MB, 10);
    assert.equal(cfg.APP_PORT, 3000);
    assert.equal(cfg.USE_EXIF_GPS, true);
    assert.equal(cfg.ENABLE_MERGE, false);
  });

  it('parses numeric optional fields', () => {
    process.env.GEMINI_API_KEY = 'key123';
    process.env.VISION_MODEL = 'gemini-1.5-flash-latest';
    process.env.CONFIDENCE_THRESHOLD = '0.7';
    process.env.MAX_UPLOAD_MB = '5';
    process.env.VISION_TIMEOUT_MS = '15000';
    const cfg = loadConfig();
    assert.equal(cfg.CONFIDENCE_THRESHOLD, 0.7);
    assert.equal(cfg.MAX_UPLOAD_MB, 5);
    assert.equal(cfg.VISION_TIMEOUT_MS, 15000);
  });

  it('parses boolean optional fields', () => {
    process.env.GEMINI_API_KEY = 'key123';
    process.env.VISION_MODEL = 'gemini-1.5-flash-latest';
    process.env.USE_EXIF_GPS = 'false';
    process.env.ENABLE_MERGE = 'true';
    const cfg = loadConfig();
    assert.equal(cfg.USE_EXIF_GPS, false);
    assert.equal(cfg.ENABLE_MERGE, true);
  });
});