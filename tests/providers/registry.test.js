const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const gemini = require('../../providers/gemini');
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
    groq.isConfigured = () => true;
    groq.listModels = async () => {
      throw new Error('auth exploded');
    };

    const result = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);
    assert.deepEqual(result.models, groq.fallbackModels);
    assert.equal(result.warning, 'auth exploded');
  });

  it('returns empty array for unknown provider', async () => {
    const result = await listModelsForProvider('nonexistent', noopIO.getDataPath, noopIO.readJSON);
    assert.deepEqual(result, { models: [], warning: null });
  });

  it('returns fallback models with warning for unconfigured groq without network', async () => {
    const result = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);
    assert.ok(Array.isArray(result.models));
    assert.ok(result.models.length > 0);
    assert.ok(result.models.every((m) => m.id && m.label));
    assert.deepEqual(result.models, groq.fallbackModels);
    assert.match(result.warning, /no está configurado/i);
    assert.match(result.warning, /credenciales/i);
  });

  it('surfaces gemini unconfigured state with fallback models and warning', async () => {
    invalidateModelsCache('gemini');
    const result = await listModelsForProvider('gemini', noopIO.getDataPath, noopIO.readJSON);
    assert.deepEqual(result.models, gemini.fallbackModels);
    assert.match(result.warning, /Gemini no está configurado/i);
    assert.match(result.warning, /credenciales/i);
  });

  it('surfaces corrupt gemini credentials instead of generic unconfigured warning', async () => {
    invalidateModelsCache('gemini');
    const { CORRUPT_ERROR } = require('../../providers/credentials-store');
    const result = await listModelsForProvider(
      'gemini',
      (f) => `/data/${f}`,
      () => null,
      () => true,
    );
    assert.deepEqual(result.models, gemini.fallbackModels);
    assert.equal(result.warning, CORRUPT_ERROR);
    assert.doesNotMatch(result.warning, /no está configurado/i);
  });

  it('caches listModels result for the same provider', async () => {
    groq.isConfigured = () => true;
    let calls = 0;
    groq.listModels = async () => {
      calls += 1;
      return [{ id: 'cached-model', label: 'Cached Model' }];
    };

    const first = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);
    const second = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);

    assert.equal(calls, 1);
    assert.deepEqual(second, first);
    assert.equal(first.models[0].id, 'cached-model');
    assert.equal(first.warning, null);
  });

  it('re-fetches models after invalidateModelsCache', async () => {
    groq.isConfigured = () => true;
    let calls = 0;
    groq.listModels = async () => {
      calls += 1;
      return [{ id: `model-${calls}`, label: `Model ${calls}` }];
    };

    await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);
    invalidateModelsCache('groq');
    const result = await listModelsForProvider('groq', noopIO.getDataPath, noopIO.readJSON);

    assert.equal(calls, 2);
    assert.equal(result.models[0].id, 'model-2');
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

  it('returns corrupt credentials error for gemini instead of generic unconfigured', async () => {
    const { CORRUPT_ERROR } = require('../../providers/credentials-store');
    const result = await callProvider(
      'gemini',
      { model: 'gemini-2.5-flash', prompt: 'hi' },
      (f) => `/data/${f}`,
      () => null,
      () => true,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, CORRUPT_ERROR);
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
