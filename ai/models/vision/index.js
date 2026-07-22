const GeminiVisionProvider = require('./geminiVision');

/**
 * @fileoverview Provider selection for vision providers.
 *
 * API keys / credentials are not wired up yet — provider instances are
 * constructed with no arguments for now.
 */

/**
 * Registry of available vision providers, keyed by provider name.
 * @type {Object<string, new () => import('./provider').VisionProvider>}
 */
const PROVIDERS = {
  gemini: GeminiVisionProvider,
};

/**
 * Returns an instance of the requested vision provider.
 *
 * @param {string} name - The provider name (e.g. "gemini").
 * @returns {import('./provider').VisionProvider} An instance implementing VisionProvider.
 */
function getVisionProvider(name) {
  const ProviderClass = PROVIDERS[name];
  if (!ProviderClass) {
    throw new Error(`Unknown vision provider: ${name}`);
  }
  return new ProviderClass();
}

module.exports = { getVisionProvider, PROVIDERS };