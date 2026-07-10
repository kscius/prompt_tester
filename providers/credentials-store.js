const FILENAME = 'credentials.json';

const CORRUPT_ERROR =
  'credentials.json está dañado o no se puede leer. Reimporta el Service Account o elimínalo manualmente.';

function inspectCredentialsFile(readJSON, filePath, fileExists) {
  if (!fileExists(filePath)) {
    return { ok: true, creds: null, corrupt: false };
  }

  const raw = readJSON(filePath);
  if (raw === null) {
    return { ok: false, creds: null, corrupt: true, error: CORRUPT_ERROR };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, creds: null, corrupt: true, error: CORRUPT_ERROR };
  }

  return { ok: true, creds: raw, corrupt: false };
}

function isValidServiceAccount(creds) {
  return (
    creds?.type === 'service_account' &&
    typeof creds.private_key === 'string' &&
    creds.private_key.trim() !== '' &&
    typeof creds.client_email === 'string' &&
    creds.client_email.trim() !== ''
  );
}

function validateServiceAccountFields(creds) {
  if (creds.type !== 'service_account') {
    return 'No es un archivo de Service Account válido (falta "type":"service_account")';
  }
  if (!creds.private_key?.trim()) {
    return 'El Service Account no incluye private_key';
  }
  if (!creds.client_email?.trim()) {
    return 'El Service Account no incluye client_email';
  }
  return null;
}

module.exports = {
  FILENAME,
  CORRUPT_ERROR,
  inspectCredentialsFile,
  isValidServiceAccount,
  validateServiceAccountFields,
};
