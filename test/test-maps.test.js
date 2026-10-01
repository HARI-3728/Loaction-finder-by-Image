// test/test-maps.test.js — Tests for Google Maps URL builder
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildMapsUrl } = require('../src/maps');

describe('maps URL builder', () => {
  it('builds URL with lat/lon', () => {
    const url = buildMapsUrl({ lat: 48.858, lon: 2.2945 });
    assert.equal(url, 'https://www.google.com/maps/search/?api=1&query=48.858,2.2945');
  });

  it('builds URL with place text', () => {
    const url = buildMapsUrl({ placeText: 'Paris, France' });
    assert.equal(url, 'https://www.google.com/maps/search/?api=1&query=Paris%2C%20France');
  });

  it('returns empty string for no input', () => {
    assert.equal(buildMapsUrl({}), '');
    assert.equal(buildMapsUrl({ lat: null }), '');
  });

  it('encodes special characters in place text', () => {
    const url = buildMapsUrl({ placeText: 'München, DE' });
    assert.ok(url.includes('M%C3%BCnchen'));
  });
});