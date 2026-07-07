const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const minimax = require('../../providers/minimax');

const ctx = {
  settings: { apiKey: 'sk-test-key', groupId: 'group-1' },
  getDataPath: (f) => `/tmp/${f}`,
  readJSON: () => null,
};

describe('providers/minimax listModels', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws when API returns HTTP 200 with base_resp login failure', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 1004, status_msg: 'login fail' },
      }),
    });

    await assert.rejects(
      () => minimax.listModels(ctx),
      (err) => {
        assert.equal(err.message, 'login fail');
        return true;
      },
    );
  });

  it('returns parsed models on success', async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.minimax.chat/v1/models');
      assert.equal(init.headers.Authorization, 'Bearer sk-test-key');
      assert.equal(init.headers['Group-Id'], 'group-1');
      return {
        ok: true,
        json: async () => ({
          base_resp: { status_code: 0, status_msg: 'success' },
          data: [{ id: 'abab6.5s-chat', display_name: 'ABAB 6.5s' }],
        }),
      };
    };

    const models = await minimax.listModels(ctx);
    assert.deepEqual(models, [{ id: 'abab6.5s-chat', label: 'ABAB 6.5s' }]);
  });

  it('throws on HTTP error so registry can surface warning', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Invalid API key' } }),
    });

    await assert.rejects(
      () => minimax.listModels(ctx),
      (err) => {
        assert.match(err.message, /Invalid API key/);
        assert.match(err.message, /\[minimax\]/);
        return true;
      },
    );
  });
});
