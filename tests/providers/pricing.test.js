const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  initPricing,
  calcCost,
  findModelRate,
  getPricingStatus,
} = require('../../providers/pricing');

function setupPricing(overrides = {}) {
  initPricing({
    getDataPath: (filename) => path.join(__dirname, '..', 'fixtures', filename),
    readJSON: overrides.readJSON ?? (() => null),
    writeJSON: overrides.writeJSON ?? (() => {}),
  });
}

describe('providers/pricing', () => {
  beforeEach(() => {
    setupPricing();
  });

  describe('calcCost', () => {
    it('calculates cost from bundled defaults for gpt-4o', () => {
      const cost = calcCost('openai', 'gpt-4o', 1_000_000, 500_000);
      assert.ok(cost > 0);
      assert.ok(Math.abs(cost - 7.5) < 0.001);
    });

    it('returns null when both token counts are zero', () => {
      assert.equal(calcCost('openai', 'gpt-4o', 0, 0), null);
    });

    it('returns null for unknown provider or model', () => {
      assert.equal(calcCost('unknown', 'gpt-4o', 1000, 500), null);
      assert.equal(calcCost('openai', 'nonexistent-model-xyz', 1000, 500), null);
    });

    it('handles prompt-only usage', () => {
      const cost = calcCost('openai', 'gpt-4o-mini', 1_000_000, 0);
      assert.ok(Math.abs(cost - 0.15) < 0.001);
    });

    it('handles output-only usage', () => {
      const cost = calcCost('gemini', 'gemini-2.5-flash', 0, 1_000_000);
      assert.ok(Math.abs(cost - 2.5) < 0.001);
    });
  });

  describe('findModelRate', () => {
    it('resolves direct model id', () => {
      const rate = findModelRate('openai', 'gpt-4o');
      assert.equal(rate.inputPerM, 2.5);
      assert.equal(rate.outputPerM, 10.0);
    });

    it('resolves prefixed model ids when cache includes litellm keys', () => {
      setupPricing({
        readJSON: () => ({
          providers: {
            openai: {
              'openai/gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
            },
          },
          source: 'litellm',
          fetchedAt: '2026-01-01T00:00:00.000Z',
        }),
      });

      const rate = findModelRate('openai', 'openai/gpt-4o-mini');
      assert.equal(rate.inputPerM, 0.15);
      assert.equal(rate.outputPerM, 0.6);
    });

    it('resolves gemini models with gemini/ prefix when cached', () => {
      setupPricing({
        readJSON: () => ({
          providers: {
            gemini: {
              'gemini/gemini-2.5-flash': { inputPerM: 0.30, outputPerM: 2.50 },
            },
          },
          source: 'litellm',
          fetchedAt: '2026-01-01T00:00:00.000Z',
        }),
      });

      const rate = findModelRate('gemini', 'gemini/gemini-2.5-flash');
      assert.equal(rate.inputPerM, 0.30);
      assert.equal(rate.outputPerM, 2.50);
    });

    it('matches partial model ids by longest prefix overlap', () => {
      const rate = findModelRate('openai', 'gpt-4o-mini-2024-07-18');
      assert.equal(rate.inputPerM, 0.15);
      assert.equal(rate.outputPerM, 0.6);
    });

    it('is case-insensitive for model lookup', () => {
      const rate = findModelRate('anthropic', 'Claude-3-5-Haiku-20241022');
      assert.equal(rate.inputPerM, 0.8);
      assert.equal(rate.outputPerM, 4.0);
    });
  });

  describe('getPricingStatus', () => {
    it('reports bundled source and model counts after init', () => {
      const status = getPricingStatus();
      assert.equal(status.source, 'bundled');
      assert.equal(status.fetchedAt, null);
      assert.equal(status.error, null);
      assert.ok(status.modelCount > 0);
      assert.ok(status.providers.openai > 0);
      assert.ok(status.providers.gemini > 0);
    });
  });

  describe('initPricing with disk cache', () => {
    it('merges remote cache over bundled defaults', () => {
      setupPricing({
        readJSON: () => ({
          providers: {
            openai: {
              'gpt-4o': { inputPerM: 99.0, outputPerM: 99.0 },
            },
          },
          source: 'litellm',
          fetchedAt: '2026-01-01T00:00:00.000Z',
        }),
      });

      const rate = findModelRate('openai', 'gpt-4o');
      assert.equal(rate.inputPerM, 99.0);
      assert.equal(rate.outputPerM, 99.0);

      const status = getPricingStatus();
      assert.equal(status.source, 'litellm');
      assert.equal(status.fetchedAt, '2026-01-01T00:00:00.000Z');
    });
  });
});
