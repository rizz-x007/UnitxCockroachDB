/**
 * @fileoverview MemoryManager — the public interface used by the
 * orchestrator to interact with memory.
 *
 * MemoryManager coordinates two underlying stores:
 *   - ConversationStore (raw conversation/message history)
 *   - VectorStore (semantic memory, for relevant-context retrieval)
 *
 * It does not implement any storage, embedding generation, or querying
 * itself — it only defines the interface the orchestrator will call, and
 * delegates to the two stores once they are implemented.
 */

/**
 * @typedef {Object} ConversationMessage
 * @property {string} role - The message role (e.g. "user", "assistant").
 * @property {string} content - The message content.
 * @property {string} [timestamp] - ISO timestamp of when the message was created.
 */

/**
 * @typedef {Object} RelevantMemory
 * @property {ConversationMessage[]} conversationHistory - Recent/relevant
 *   conversation history for the session.
 * @property {Array<Object>} semanticMatches - Relevant items retrieved from
 *   semantic (vector) memory.
 */

class MemoryManager {
  /**
   * @param {Object} dependencies
   * @param {Object} dependencies.conversationStore - An instance of
   *   ConversationStore (see ./conversationStore.js).
   * @param {Object} dependencies.vectorStore - An instance of VectorStore
   *   (see ./vectorStore.js).
   */
  constructor({ conversationStore, vectorStore } = {}) {
    /** @type {Object} */
    this.conversationStore = conversationStore;
    /** @type {Object} */
    this.vectorStore = vectorStore;
  }

  /**
   * Saves a conversation exchange (and, eventually, any derived semantic
   * memory) for a given session.
   *
   * @param {string} sessionId - The conversation/session identifier.
   * @param {ConversationMessage[]} messages - The message(s) to save.
   * @returns {Promise<void>}
   */
  async saveConversation(sessionId, messages) {
    throw new Error('Not implemented');
  }

  /**
   * Retrieves memory relevant to a given query and session, combining
   * conversation history with semantic search results.
   *
   * @param {string} sessionId - The conversation/session identifier.
   * @param {string} query - The text to find relevant memory for.
   * @returns {Promise<RelevantMemory>} The relevant memory.
   */
  async retrieveRelevantMemory(sessionId, query) {
    throw new Error('Not implemented');
  }

  /**
   * Clears all stored memory (conversation and semantic) for a given session.
   *
   * @param {string} sessionId - The conversation/session identifier.
   * @returns {Promise<void>}
   */
  async clearSession(sessionId) {
    throw new Error('Not implemented');
  }
}

module.exports = MemoryManager;