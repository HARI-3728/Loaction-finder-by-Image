const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const llm = require('../src/llm');

describe('vision / llm helpers', () => {

  test('parseJson returns object for plain JSON string', () => {
    const obj = llm.parseJson('{"country":"US"}');
    assert.equal(obj.country, 'US');
  });

  test('parseJson handles markdown code fences', () => {
    const obj = llm.parseJson('```json\n{"country":"US"}\n```');
    assert.equal(obj.country, 'US');
  });

  test('parseJson returns null for garbage', () => {
    const obj = llm.parseJson('not json');
    assert.equal(obj, null);
  });

  test('parseJson extracts first brace block', () => {
    const text = 'Here is the result: {"country":"US"} end.';
    const obj = llm.parseJson(text);
    assert.equal(obj.country, 'US');
  });

  test('complete throws without API key', async () => {
    const originalKey = process.env.OPENROUTER_API_KEY;

    delete process.env.OPENROUTER_API_KEY;

    try {
      await llm.complete({
        provider: 'openrouter',
        model: 'test',
        messages: [],
        timeoutMs: 100
      });

      assert.fail('Should have thrown');
    } catch (err) {
      assert.match(err.message, /Missing API key/);
    } finally {
      if (originalKey !== undefined) {
        process.env.OPENROUTER_API_KEY = originalKey;
      } else {
        delete process.env.OPENROUTER_API_KEY;
      }
    }
  });

});