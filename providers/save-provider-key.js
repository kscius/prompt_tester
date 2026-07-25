/**
 * Build provider settings for an API-key save (shared by IPC and tests).
 * @returns {{ ok: true, settings: object } | { ok: false, error: string }}
 */
function buildProviderApiKeySettings(providerId, apiKey, groupId) {
  const trimmed = (apiKey ?? '').trim();
  if (!trimmed) return { ok: false, error: 'API key vacía' };

  const settings = { apiKey: trimmed };
  // MiniMax: always apply groupId from the payload so an empty field clears
  // a previously saved Group-Id (setProviderSettings treats null as delete).
  if (providerId === 'minimax' && groupId !== undefined) {
    const trimmedGroup = String(groupId ?? '').trim();
    settings.groupId = trimmedGroup || null;
  } else if (groupId?.trim()) {
    settings.groupId = groupId.trim();
  }
  if (providerId === 'gemini') {
    settings.authMode = 'apiKey';
  }
  return { ok: true, settings };
}

/**
 * Persist API key settings, then clear Gemini service-account file only after
 * a successful write. Unlinking before setProviderSettings can destroy the SA
 * when provider-config.json is corrupt / unwritable.
 *
 * @param {object} args
 * @param {string} args.providerId
 * @param {string} args.apiKey
 * @param {string} [args.groupId]
 * @param {(id: string, settings: object) => void} args.setProviderSettings
 * @param {() => void} [args.clearGeminiServiceAccount] called only after persist succeeds
 */
function saveProviderApiKey({
  providerId,
  apiKey,
  groupId,
  setProviderSettings,
  clearGeminiServiceAccount,
}) {
  const built = buildProviderApiKeySettings(providerId, apiKey, groupId);
  if (!built.ok) return built;

  setProviderSettings(providerId, built.settings);

  if (providerId === 'gemini' && typeof clearGeminiServiceAccount === 'function') {
    clearGeminiServiceAccount();
  }

  return { ok: true, settings: built.settings };
}

module.exports = {
  buildProviderApiKeySettings,
  saveProviderApiKey,
};
