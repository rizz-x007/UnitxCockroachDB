const BedrockClaudeProvider = require('./bedrockClaude');
const BedrockNovaProvider = require('./bedrockNova');
const GeminiReasoningProvider = require('./geminiReasoning');

/**
 * @fileoverview Provider selection for reasoning providers.
 *
 * Allows dynamic instantiations of LLM providers with regional,
 * credentials, or model-specific configurations.
 */

/**
 * Registry of available reasoning providers, keyed by provider name.
 * @type {Object<string, new (config?: Object) => import('./provider').ReasoningProvider>}
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
 * @param {Object} [config] - Provider-specific construction config (e.g. { region, modelId }).
 * @returns {import('./provider').ReasoningProvider} An instance implementing ReasoningProvider.
 */
function getReasoningProvider(name, config) {
  const ProviderClass = PROVIDERS[name];
  if (!ProviderClass) {
    throw new Error(`Unknown reasoning provider: ${name}`);
  }
  return new ProviderClass(config);
}

module.exports = { getReasoningProvider, PROVIDERS };