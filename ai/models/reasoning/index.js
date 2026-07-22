const BedrockClaudeProvider = require('./bedrockClaude');
const BedrockNovaProvider = require('./bedrockNova');
const GeminiReasoningProvider = require('./geminiReasoning');

/**
 * @fileoverview Provider selection for reasoning providers.
 *
 * API keys / credentials are not wired up yet — provider instances are
 * constructed with no arguments for now.
 */

/**
 * Registry of available reasoning providers, keyed by provider name.
 * @type {Object<string, new () => import('./provider').ReasoningProvider>}
 */
const PROVIDERS = {
  bedrockClaude: BedrockClaudeProvider,
  bedrockNova: BedrockNovaProvider,
  gemini: GeminiReasoningProvider,
};

/**
 * Returns an instance of the requested reasoning provider.
 *
 * @param {string} name - The provider name (e.g. "bedrockClaude", "bedrockNova", "gemini").
 * @returns {import('./provider').ReasoningProvider} An instance implementing ReasoningProvider.
 */
function getReasoningProvider(name) {
  const ProviderClass = PROVIDERS[name];
  if (!ProviderClass) {
    throw new Error(`Unknown reasoning provider: ${name}`);
  }
  return new ProviderClass();
}

module.exports = { getReasoningProvider, PROVIDERS };