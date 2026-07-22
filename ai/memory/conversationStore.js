/**
 * @fileoverview ConversationStore — represents conversation history storage.
 *
 * No database queries or storage implementation are included here — only
 * the interface and documentation for saving and retrieving conversation
 * messages.
 */

/**
 * @typedef {Object} ConversationMessage
 * @property {string} role - The message role (e.g. "user", "assistant").
 * @property {string} content - The message content.
 * @property {string} [timestamp] - ISO timestamp of when the message was created.
 */

class ConversationStore {
  /**
   * Saves one or more messages to a session's conversation history.
   *
   * @param {string} sessionId - The conversation/session identifier.
   * @param {ConversationMessage[]} messages - The message(s) to save.
   * @returns {Promise<void>}
   */
  async saveMessages(sessionId, messages) {
    throw new Error('Not implemented');
  }

  /**
   * Retrieves conversation history for a session.
   *
   * @param {string} sessionId - The conversation/session identifier.
   * @param {Object} [options] - Retrieval options (e.g. limit, before/after timestamp).
   * @returns {Promise<ConversationMessage[]>} The conversation history, ordered oldest to newest.
   */
  async getMessages(sessionId, options) {
    throw new Error('Not implemented');
  }

  /**
   * Deletes all stored messages for a session.
   *
   * @param {string} sessionId - The conversation/session identifier.
   * @returns {Promise<void>}
   */
  async deleteMessages(sessionId) {
    throw new Error('Not implemented');
  }
}

module.exports = ConversationStore;