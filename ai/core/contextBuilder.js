/**
 * @fileoverview ContextBuilder — responsible for constructing the context
 * that gets sent to the LLM alongside a prepared prompt.
 *
 * This module describes the shape of context assembly (what inputs it will
 * take and what it will return) without implementing any retrieval logic.
 * Retrieval (e.g. from a database, vector store, or memory layer) will be
 * added later.
 */

/**
 * @typedef {Object} ContextRequest
 * @property {string} [userId] - The requesting user's identifier, if known.
 * @property {string} [sessionId] - The conversation/session identifier, if known.
 * @property {string} [input] - The raw user input this context is being built for.
 */

/**
 * @typedef {Object} Context
 * @property {Array<{role: string, content: string}>} conversationHistory - Prior
 *   conversation turns relevant to this request. Empty until memory is implemented.
 * @property {Array<Object>} retrievedDocuments - Documents/snippets retrieved to
 *   ground the response (e.g. from embeddings-based search). Empty until
 *   retrieval is implemented.
 * @property {Object} userProfile - Known information about the requesting user.
 *   Empty until user data retrieval is implemented.
 * @property {Object} metadata - Any additional context metadata.
 */

class ContextBuilder {
  /**
   * Builds the full context object for a request.
   *
   * This is a placeholder — it does not perform any retrieval yet. It
   * returns an empty/placeholder Context describing the shape callers
   * should expect once retrieval is implemented.
   *
   * @param {ContextRequest} request - Describes what the context is being built for.
   * @returns {Promise<Context>} The assembled context.
   */
  async buildContext(request) {
    throw new Error('Not implemented');
  }

  /**
   * Retrieves prior conversation history relevant to the request.
   *
   * Placeholder for future memory integration.
   *
   * @param {ContextRequest} request - Describes what history is being retrieved for.
   * @returns {Promise<Array<{role: string, content: string}>>} The conversation history.
   */
  async getConversationHistory(request) {
    throw new Error('Not implemented');
  }

  /**
   * Retrieves documents/snippets relevant to the request (e.g. via
   * embeddings-based similarity search).
   *
   * Placeholder for future retrieval integration.
   *
   * @param {ContextRequest} request - Describes what is being retrieved for.
   * @returns {Promise<Array<Object>>} The retrieved documents.
   */
  async getRelevantDocuments(request) {
    throw new Error('Not implemented');
  }

  /**
   * Retrieves known information about the requesting user.
   *
   * Placeholder for future user-data integration.
   *
   * @param {ContextRequest} request - Describes what profile is being retrieved for.
   * @returns {Promise<Object>} The user profile data.
   */
  async getUserProfile(request) {
    throw new Error('Not implemented');
  }
}

module.exports = ContextBuilder;