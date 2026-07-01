const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const groq = require('../../providers/groq');
const {
  listModelsForProvider,
  invalidateModelsCache,
} = require('../../providers/registry');

const noopIO = {
  getDataPath: (f) => `/tmp/${f}`,
  readJSON: () => null,
};

describe('providers/registry', () => {
  let originalListModels;

  beforeEach(() => {
    invalidateModelsCache();
    originalListModels = groq.listModels;
  });

  afterEach(() => {
    groq.listModels = originalListModels;
    invalidateModelsCache('groq');
  });

  it('returns fallback models when listModels throws', async () => {
    groq.listModels = async () => {
      throw new Error('auth exploded');
    };

    const models = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);
    assert.deepEqual(models, groq.fallbackModels);
  });

  it('returns empty array for unknown provider', async () => {
    const models = await listModelsForProvider('nonexistent', noopIO.getDataPath, noopIO.readJSON);
    assert.deepEqual(models, []);
  });

  it('returns fallback models for unconfigured groq without network', async () => {
    const models = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);
    assert.ok(Array.isArray(models));
    assert.ok(models.length > 0);
    assert.ok(models.every((m) => m.id && m.label));
  });
});
