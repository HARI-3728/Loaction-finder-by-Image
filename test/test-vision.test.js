// test/test-vision.test.js — Tests for vision module JSON parsing / structure
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// We test the LLM parseJson helper which vision relies on
const llm = require('../src/llm');

describe('vision / llm helpers', () => {
  it('parseJson returns object for plain JSON string', () => {
    const text = '{"determinable":true,"country":"FR","state":null,"city":"Paris","place_name":"Eiffel Tower","confidence":0.9,"clues":["tower"]}';
    const obj = llm.parseJson(text);
    assert.equal(obj.country, 'FR');
    assert.equal(obj.city, 'Paris');
    assert.equal(obj.confidence, 0.9);
  });

  it('parseJson handles markdown code fences', () => {
    const text = '```json\n{"determinable":false,"country":null,"state":null,"city":null,"place_name":null,"confidence":0,"clues":[]}\n```';
    const obj = llm.parseJson(text);
    assert.equal(obj.determinable, false);
  });

  it('parseJson returns null for garbage', () => {
    assert.equal(llm.parseJson('not json at all'), null);
    assert.equal(llm.parseJson(''), null);
    assert.equal(llm.parseJson(null), null);
  });

  it('parseJson extracts first brace block', () => {
    const text = 'Here is the result: {"country":"US"} end.';
    const obj = llm.parseJson(text);
    assert.equal(obj.country, 'US');
  });

  it('complete throws without API key', async () => {
    // Ensure no key is set
    const orig = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      await llm.complete({ provider: 'openrouter', model: 'test', messages: [], timeoutMs: 100 });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('Missing API key'));
    } finally {
      if (orig) process.env.OPENROUTER_API_KEY = orig;
    }
  });
});