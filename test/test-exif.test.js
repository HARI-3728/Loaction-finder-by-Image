// test/test-exif.test.js â€” Tests for EXIF GPS extraction
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Minimal valid JPEG with EXIF APP1 segment containing no GPS
// We test the exif module's interface, not real GPS data
const exif = require('../src/exif');

describe('exif', () => {
  it('returns null coordinates for buffer without GPS', () => {
    // Minimal JPEG SOI + EOI (no EXIF, no GPS)
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);
    const result = exif.getGpsFromBuffer(buf);
    assert.equal(result, null);
  });

  it('returns null for empty buffer', () => {
    const result = exif.getGpsFromBuffer(Buffer.alloc(0));
    assert.equal(result, null);
  });

  it('returns null for non-buffer input', () => {
    const result = exif.getGpsFromBuffer('not a buffer');
    assert.equal(result, null);
  });

  it('getGpsData returns null for no GPS', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);
    const result = exif.getGpsFromBuffer(buf);
    assert.equal(result, null);
  });
});
