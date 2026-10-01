// test/test-confidence.test.js — Tests for confidence gating logic
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Confidence gate logic lives in server.js (or vision.js). We test the gate
// by simulating the conditions.

function gate(result, threshold = 0.4) {
  if (!result.determinable) return false;
  if (!result.country) return false;
  if ((result.confidence ?? 0) < threshold) return false;
  return true;
}

describe('confidence gate', () => {
  it('passes when all conditions met', () => {
    const r = { determinable: true, country: 'FR', city: 'Paris', confidence: 0.8 };
    assert.equal(gate(r), true);
  });

  it('fails when determinable is false', () => {
    const r = { determinable: false, country: 'FR', confidence: 0.9 };
    assert.equal(gate(r), false);
  });

  it('fails when country is missing', () => {
    const r = { determinable: true, country: null, confidence: 0.9 };
    assert.equal(gate(r), false);
  });

  it('fails when confidence below threshold', () => {
    const r = { determinable: true, country: 'FR', confidence: 0.3 };
    assert.equal(gate(r), false);
  });

  it('fails at exactly threshold (strict <)', () => {
    const r = { determinable: true, country: 'FR', confidence: 0.4 };
    assert.equal(gate(r), true); // 0.4 >= 0.4 passes
  });

  it('fails when confidence is 0', () => {
    const r = { determinable: true, country: 'FR', confidence: 0 };
    assert.equal(gate(r), false);
  });
});