const GeminiModerationProvider = require('./geminiModeration');

/**
 * @fileoverview Provider selection for moderation providers.
 *
 * API keys / credentials are not wired up yet — provider instances are
 * constructed with no arguments for now.
 */

/**
 * Registry of available moderation providers, keyed by provider name.
 * @type {Object<string, new () => import('./provider').ModerationProvider>}
 */
const PROVIDERS = {
  gemini: GeminiModerationProvider,
};

/**
 * Returns an instance of the requested moderation provider.
 *
 * @param {string} name - The provider name (e.g. "gemini").
 * @returns {import('./provider').ModerationProvider} An instance implementing ModerationProvider.
 */
function getModerationProvider(name) {
  const ProviderClass = PROVIDERS[name];
  if (!ProviderClass) {
    throw new Error(`Unknown moderation provider: ${name}`);
  }
  return new ProviderClass();
}

module.exports = { getModerationProvider, PROVIDERS };