const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const groq = require('../../providers/groq');
const {
  listModelsForProvider,
  invalidateModelsCache,
  callProvider,
} = require('../../providers/registry');

const noopIO = {
  getDataPath: (f) => `/tmp/${f}`,
  readJSON: () => null,
};

describe('providers/registry', () => {
  let originalListModels;
  let originalIsConfigured;
  let originalGenerate;

  beforeEach(() => {
    invalidateModelsCache();
    originalListModels = groq.listModels;
    originalIsConfigured = groq.isConfigured;
    originalGenerate = groq.generate;
  });

  afterEach(() => {
    groq.listModels = originalListModels;
    groq.isConfigured = originalIsConfigured;
    groq.generate = originalGenerate;
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

  it('caches listModels result for the same provider', async () => {
    let calls = 0;
    groq.listModels = async () => {
      calls += 1;
      return [{ id: 'cached-model', label: 'Cached Model' }];
    };

    const first = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);
    const second = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);

    assert.equal(calls, 1);
    assert.deepEqual(second, first);
    assert.equal(first[0].id, 'cached-model');
  });

  it('re-fetches models after invalidateModelsCache', async () => {
    let calls = 0;
    groq.listModels = async () => {
      calls += 1;
      return [{ id: `model-${calls}`, label: `Model ${calls}` }];
    };

    await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);
    invalidateModelsCache('groq');
    const models = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);

    assert.equal(calls, 2);
    assert.equal(models[0].id, 'model-2');
  });
});

describe('providers/registry callProvider', () => {
  let originalIsConfigured;
  let originalGenerate;

  beforeEach(() => {
    originalIsConfigured = groq.isConfigured;
    originalGenerate = groq.generate;
  });

  afterEach(() => {
    groq.isConfigured = originalIsConfigured;
    groq.generate = originalGenerate;
  });

  it('returns error for unknown provider', async () => {
    const result = await callProvider('nonexistent', { model: 'x', prompt: 'hi' }, noopIO.getDataPath, noopIO.readJSON);
    assert.equal(result.ok, false);
    assert.match(result.error, /desconocido/);
  });

  it('returns error when provider is not configured', async () => {
    const result = await callProvider('groq', { model: 'llama', prompt: 'hi' }, noopIO.getDataPath, noopIO.readJSON);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Proveedor no configurado.');
  });

  it('delegates to provider.generate when configured', async () => {
    groq.isConfigured = () => true;
    groq.generate = async (_ctx, args) => ({
      ok: true,
      text: `echo:${args.prompt}`,
      usage: { promptTokenCount: 5, candidatesTokenCount: 10, totalTokenCount: 15 },
    });

    const result = await callProvider(
      'groq',
      { model: 'llama-3.3-70b-versatile', prompt: 'hola', data: '', temperature: 0.7 },
      noopIO.getDataPath,
      noopIO.readJSON,
    );

    assert.equal(result.ok, true);
    assert.equal(result.text, 'echo:hola');
    assert.equal(result.usage.totalTokenCount, 15);
  });

  it('propagates generate errors from provider', async () => {
    groq.isConfigured = () => true;
    groq.generate = async () => ({ ok: false, error: 'Rate limit exceeded' });

    const result = await callProvider('groq', { model: 'llama', prompt: 'hi' }, noopIO.getDataPath, noopIO.readJSON);

    assert.equal(result.ok, false);
    assert.equal(result.error, 'Rate limit exceeded');
  });
});
