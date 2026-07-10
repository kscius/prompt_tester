const FILENAME = 'saved-prompts.json';

const CORRUPT_ERROR =
  'No se pudieron cargar los presets: saved-prompts.json está dañado. Renómbralo o corrígelo manualmente.';
const INVALID_SHAPE_ERROR =
  'No se pudieron cargar los presets: saved-prompts.json no tiene el formato esperado.';

function isValidPromptEntry(entry) {
  return Boolean(entry && typeof entry.name === 'string' && entry.name.trim() !== '');
}

function inspectSavedPromptsFile(readJSON, filePath, fileExists) {
  if (!fileExists(filePath)) {
    return { ok: true, prompts: [], corrupt: false };
  }

  const raw = readJSON(filePath);
  if (raw === null) {
    return { ok: false, prompts: [], corrupt: true, error: CORRUPT_ERROR };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, prompts: [], corrupt: true, error: INVALID_SHAPE_ERROR };
  }

  return { ok: true, prompts: raw.filter(isValidPromptEntry), corrupt: false };
}

function assertSavedPromptsWritable(inspection) {
  if (inspection.corrupt) {
    const err = new Error(inspection.error);
    err.code = 'PROMPTS_READ_FAILED';
    throw err;
  }
}

module.exports = {
  FILENAME,
  CORRUPT_ERROR,
  INVALID_SHAPE_ERROR,
  isValidPromptEntry,
  inspectSavedPromptsFile,
  assertSavedPromptsWritable,
};
