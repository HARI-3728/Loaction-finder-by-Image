// ==== FILEPATH: test/test-locate.test.js ====
'use strict';

const { test }   = require('node:test');
const assert     = require('node:assert/strict');

// ── Unit tests for the locate pipeline helper modules ──────────────────────

// Candidate generator
const { generateCandidates } = require('../src/geolocation/candidate_generator.js');

test('generateCandidates – returns VISION candidate when place_name provided', () => {
  const vision = {
    country:    'France',
    state:      'Île-de-France',
    city:       'Paris',
    place_name: 'Eiffel Tower',
    confidence: 0.9,
    determinable: true,
    clues: ['Eiffel Tower visible in background'],
  };
  const candidates = generateCandidates(vision, null);
  assert.ok(Array.isArray(candidates), 'should return an array');
  assert.ok(candidates.length > 0, 'should have at least one candidate');
  assert.equal(candidates[0].place_name, 'Eiffel Tower');
  assert.equal(candidates[0].country,    'France');
});

test('generateCandidates – EXIF GPS candidate is prepended when GPS present', () => {
  const vision = {
    country:    'Japan',
    state:      'Tokyo',
    city:       'Shinjuku',
    place_name: null,
    confidence: 0.7,
    determinable: true,
    clues: ['Japanese signage visible'],
  };
  const exifGps = { lat: 35.6895, lon: 139.6917 };
  const candidates = generateCandidates(vision, exifGps);
  const exifCandidate = candidates.find((c) => c.source === 'EXIF_GPS');
  assert.ok(exifCandidate, 'EXIF_GPS candidate should exist');
  assert.equal(exifCandidate.latitude,  35.6895);
  assert.equal(exifCandidate.longitude, 139.6917);
});

// Contradiction detector
const { detectContradictions } = require('../src/verification/contradiction.js');

test('detectContradictions – no contradictions when evidence is empty', () => {
  const result = detectContradictions([]);
  assert.deepEqual(result, []);
});

test('detectContradictions – detects OCR vs VISION mismatch', () => {
  const evidence = [
    { source: 'OCR',    description: 'Germany', strength: 1.0 },
    { source: 'VISION', description: 'France',  strength: 1.0 },
  ];
  const result = detectContradictions(evidence);
  assert.ok(result.length > 0, 'should have at least one contradiction');
  assert.equal(result[0].severity, 'high');
});

// Confidence calculator
const { calculateConfidence } = require('../src/verification/confidence.js');

test('calculateConfidence – low score yields "low" level', () => {
  const result = calculateConfidence({ score: 0, contradictions: [], evidence: [], cfg: {} });
  assert.equal(result.level, 'low');
  assert.equal(result.determinable, false);
});

test('calculateConfidence – high contradiction downgrades level', () => {
  const evidence = [{ source: 'VISION', description: 'test', strength: 1.0 }];
  const contradictions = [{ severity: 'high' }];
  const result = calculateConfidence({
    score: 3,
    contradictions,
    evidence,
    cfg: { CONFIDENCE_THRESHOLD: 0.4 },
  });
  assert.equal(result.level, 'medium'); // should be downgraded from high → medium
});

// buildMapsUrl
const { buildMapsUrl } = require('../src/maps.js');

test('buildMapsUrl – uses lat/lon when both are provided', () => {
  const url = buildMapsUrl(48.8566, 2.3522, 'Paris, France');
  assert.ok(url.includes('48.8566'), 'URL should contain latitude');
  assert.ok(url.includes('2.3522'),  'URL should contain longitude');
});

test('buildMapsUrl – falls back to place name when no coordinates', () => {
  const url = buildMapsUrl(null, null, 'Tokyo, Japan');
  assert.ok(url.includes('Tokyo'), 'URL should contain place name');
});
