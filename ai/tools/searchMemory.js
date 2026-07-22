/**
 * @fileoverview SearchMemoryTool — interface to the future memory module.
 *
 * This is a placeholder for now. Memory storage and retrieval are not
 * implemented anywhere in this codebase yet; this tool only defines the
 * shape callers should expect once memory is integrated.
 */

/**
 * @typedef {Object} MemoryEntry
 * @property {string} id - Unique memory entry identifier.
 * @property {string} content - The stored memory content.
 * @property {string} createdAt - ISO timestamp of when the entry was created.
 * @property {Object} metadata - Additional metadata about the memory entry.
 */

class SearchMemoryTool {
  /**
   * Searches stored memory relevant to a query.
   *
   * @param {string} query - The search query text.
   * @param {Object} [context] - Additional context (e.g. userId, sessionId)
   *   to scope the memory search.
   * @returns {Promise<MemoryEntry[]>} Matching memory entries.
   */
  async search(query, context) {
    throw new Error('Not implemented');
  }
}

module.exports = SearchMemoryTool;