/**
 * @fileoverview Interface definition for reasoning (LLM) providers.
 *
 * There is no shared implementation between reasoning providers, so this
 * file documents the required method shape rather than defining a base
 * class to extend. Concrete providers (e.g. Bedrock Claude, Bedrock Nova,
 * Gemini) are standalone classes that implement the methods described
 * below with matching signatures.
 *
 * @typedef {Object} ReasoningProvider
 * @property {function(Array<{role: string, content: string}>, Object=): AsyncIterable<string>} stream
 *   Streams a response for a multi-turn conversation, yielding chunks of
 *   generated text as they become available.
 * @property {function(): boolean} supportsToolCalling
 *   Indicates whether this provider/model supports tool calling.
 */

module.exports = {};