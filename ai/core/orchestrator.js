/**
 * @fileoverview Orchestrator — the main coordinator of the AI workflow.
 *
 * The orchestrator ties together context building, tool registration, prompt
 * preparation, and a reasoning provider to turn a user request into a
 * response. It contains no business logic, no SQL, and no knowledge of how
 * any individual provider is implemented — it only knows the interfaces
 * defined in ai/models and the other ai/core modules.
 *
 * Memory (conversation/session persistence) is not implemented yet and will
 * be integrated later. Where memory will eventually plug in is noted inline.
 */

/**
 * @typedef {Object} UserRequest
 * @property {string} input - The raw user input/message.
 * @property {string} [userId] - The requesting user's identifier, if known.
 * @property {string} [sessionId] - The conversation/session identifier, if known.
 * @property {Object} [metadata] - Any additional request metadata.
 */

/**
 * @typedef {Object} OrchestratorResponse
 * @property {string} output - The final response text to return to the caller.
 * @property {Object} [meta] - Additional metadata about how the response was produced
 *   (e.g. which provider was used, tools invoked, timing).
 */

class Orchestrator {
  /**
   * @param {Object} dependencies
   * @param {Object} dependencies.reasoningProviders - Provider selection module for
   *   reasoning providers (e.g. the `index.js` from ai/models/reasoning), exposing a
   *   `getReasoningProvider(name)` factory.
   * @param {Object} dependencies.contextBuilder - An instance of ContextBuilder
   *   (see ./contextBuilder.js).
   * @param {Object} dependencies.toolRegistry - An instance of ToolRegistry
   *   (see ./toolRegistry.js).
   */
  constructor({ reasoningProviders, contextBuilder, toolRegistry } = {}) {
    /** @type {Object} */
    this.reasoningProviders = reasoningProviders;
    /** @type {Object} */
    this.contextBuilder = contextBuilder;
    /** @type {Object} */
    this.toolRegistry = toolRegistry;
  }

  /**
   * Selects which reasoning provider should handle a given request.
   *
   * This is a placeholder — selection strategy (e.g. based on request type,
   * cost, latency, or tool-calling needs) will be decided later.
   *
   * @param {UserRequest} request - The incoming user request.
   * @returns {Object} A reasoning provider instance implementing the
   *   ReasoningProvider interface (see ai/models/reasoning/provider.js).
   */
  selectReasoningProvider(request) {
    throw new Error('Not implemented');
  }

  /**
   * Prepares the final prompt/message list to send to the reasoning provider,
   * combining the built context, available tools, and prompt templates.
   *
   * @param {Object} context - The context object produced by contextBuilder
   *   (see ai/core/contextBuilder.js).
   * @param {Array<Object>} tools - The tools available for this request, as
   *   returned by toolRegistry.getAllTools().
   * @param {UserRequest} request - The incoming user request.
   * @returns {Array<{role: string, content: string}>} The prepared message list.
   */
  preparePrompt(context, tools, request) {
    throw new Error('Not implemented');
  }

  /**
   * Processes a single user request end-to-end:
   *   1. receives the request
   *   2. selects a reasoning provider
   *   3. requests context from contextBuilder
   *   4. obtains available tools from toolRegistry
   *   5. prepares the prompt
   *   6. calls the reasoning provider
   *   7. returns the response
   *
   * Memory read/write will be integrated into this flow later (e.g. loading
   * prior conversation state before step 3, and persisting the exchange
   * after step 7).
   *
   * @param {UserRequest} request - The incoming user request.
   * @returns {Promise<OrchestratorResponse>} The response to return to the caller.
   */
  async processRequest(request) {
    throw new Error('Not implemented');
  }
}

module.exports = Orchestrator;