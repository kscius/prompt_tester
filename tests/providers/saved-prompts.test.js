const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  inspectSavedPromptsFile,
  assertSavedPromptsWritable,
  isValidPromptEntry,
  CORRUPT_ERROR,
  INVALID_SHAPE_ERROR,
} = require('../../providers/saved-prompts');

const FILE = '/tmp/saved-prompts.json';

describe('providers/saved-prompts', () => {
  it('isValidPromptEntry accepts named presets only', () => {
    assert.equal(isValidPromptEntry({ name: 'demo' }), true);
    assert.equal(isValidPromptEntry({ name: '  ' }), false);
    assert.equal(isValidPromptEntry({}), false);
    assert.equal(isValidPromptEntry(null), false);
  });

  it('returns empty list when file is missing', () => {
    const result = inspectSavedPromptsFile(
      () => null,
      FILE,
      () => false,
    );
    assert.deepEqual(result, { ok: true, prompts: [], corrupt: false });
  });

  it('flags corrupt JSON when file exists but readJSON returns null', () => {
    const result = inspectSavedPromptsFile(
      () => null,
      FILE,
      () => true,
    );
    assert.equal(result.ok, false);
    assert.equal(result.corrupt, true);
    assert.equal(result.error, CORRUPT_ERROR);
    assert.deepEqual(result.prompts, []);
  });

  it('flags invalid shape when parsed value is not an array', () => {
    const result = inspectSavedPromptsFile(
      () => ({ presets: [] }),
      FILE,
      () => true,
    );
    assert.equal(result.ok, false);
    assert.equal(result.corrupt, true);
    assert.equal(result.error, INVALID_SHAPE_ERROR);
  });

  it('filters invalid entries from a valid array', () => {
    const result = inspectSavedPromptsFile(
      () => [{ name: 'ok' }, { prompt: 'no-name' }, null, { name: 'also-ok' }],
      FILE,
      () => true,
    );
    assert.equal(result.ok, true);
    assert.equal(result.corrupt, false);
    assert.deepEqual(result.prompts, [{ name: 'ok' }, { name: 'also-ok' }]);
  });

  it('assertSavedPromptsWritable throws when file is corrupt', () => {
    assert.throws(
      () =>
        assertSavedPromptsWritable({
          ok: false,
          corrupt: true,
          error: CORRUPT_ERROR,
          prompts: [],
        }),
      (err) => err.code === 'PROMPTS_READ_FAILED' && err.message === CORRUPT_ERROR,
    );
  });
});
