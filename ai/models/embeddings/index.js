const TitanEmbeddingProvider = require('./titan');

/**
 * @fileoverview Provider selection for embedding providers.
 *
 * API keys / credentials are not wired up yet — provider instances are
 * constructed with no arguments for now.
 */

/**
 * Registry of available embedding providers, keyed by provider name.
 * @type {Object<string, new () => import('./provider')>}
 */
const PROVIDERS = {
  titan: TitanEmbeddingProvider,
};

/**
 * Returns an instance of the requested embedding provider.
 *
 * @param {string} name - The provider name (e.g. "titan").
 * @returns {import('./provider')} An instance implementing EmbeddingProvider.
 */
function getEmbeddingProvider(name) {
  const ProviderClass = PROVIDERS[name];
  if (!ProviderClass) {
    throw new Error(`Unknown embedding provider: ${name}`);
  }
  return new ProviderClass();
}

module.exports = { getEmbeddingProvider, PROVIDERS };