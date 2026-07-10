const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CORRUPT_ERROR,
  inspectCredentialsFile,
  isValidServiceAccount,
  validateServiceAccountFields,
} = require('../../providers/credentials-store');

const SA_CREDS = {
  type: 'service_account',
  project_id: 'my-project',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
  client_email: 'sa@my-project.iam.gserviceaccount.com',
};

describe('providers/credentials-store', () => {
  describe('inspectCredentialsFile', () => {
    it('returns ok when file is missing', () => {
      const result = inspectCredentialsFile(() => null, '/data/credentials.json', () => false);
      assert.equal(result.ok, true);
      assert.equal(result.corrupt, false);
      assert.equal(result.creds, null);
    });

    it('detects corrupt JSON (readJSON returns null)', () => {
      const result = inspectCredentialsFile(() => null, '/data/credentials.json', () => true);
      assert.equal(result.ok, false);
      assert.equal(result.corrupt, true);
      assert.equal(result.error, CORRUPT_ERROR);
    });

    it('detects invalid shape (non-object)', () => {
      const result = inspectCredentialsFile(() => 'not-json', '/data/credentials.json', () => true);
      assert.equal(result.ok, false);
      assert.equal(result.corrupt, true);
    });

    it('returns creds for valid JSON object', () => {
      const result = inspectCredentialsFile(() => SA_CREDS, '/data/credentials.json', () => true);
      assert.equal(result.ok, true);
      assert.equal(result.corrupt, false);
      assert.deepEqual(result.creds, SA_CREDS);
    });
  });

  describe('isValidServiceAccount', () => {
    it('accepts complete service account', () => {
      assert.equal(isValidServiceAccount(SA_CREDS), true);
    });

    it('rejects missing private_key', () => {
      const { private_key, ...rest } = SA_CREDS;
      assert.equal(isValidServiceAccount(rest), false);
    });

    it('rejects wrong type', () => {
      assert.equal(isValidServiceAccount({ type: 'api_key' }), false);
    });
  });

  describe('validateServiceAccountFields', () => {
    it('returns null for valid creds', () => {
      assert.equal(validateServiceAccountFields(SA_CREDS), null);
    });

    it('returns message for wrong type', () => {
      assert.match(validateServiceAccountFields({ type: 'other' }), /Service Account/);
    });

    it('returns message for missing private_key', () => {
      const { private_key, ...rest } = SA_CREDS;
      assert.match(validateServiceAccountFields(rest), /private_key/);
    });
  });
});
