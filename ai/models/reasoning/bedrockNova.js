/**
 * @fileoverview Amazon Bedrock (Nova) implementation of the ReasoningProvider
 * interface (see ./provider.js for the interface definition).
 *
 * This is a placeholder skeleton only — no API calls have been implemented yet.
 *
 * @implements {import('./provider').ReasoningProvider}
 */

class BedrockNovaProvider {
  /**
   * Streams a response for a multi-turn conversation.
   *
   * @param {Array<{role: string, content: string}>} messages - The conversation
   *   history, ordered oldest to newest.
   * @param {Object} [options] - Provider-specific generation options
   *   (e.g. temperature, max tokens).
   * @returns {AsyncIterable<string>} An async iterable yielding text chunks.
   */
  async stream(messages, options) {
    throw new Error('Not implemented');
  }

  /**
   * Indicates whether this provider/model supports tool calling.
   *
   * @returns {boolean}
   */
  supportsToolCalling() {
    throw new Error('Not implemented');
  }
}

module.exports = BedrockNovaProvider;