/**
 * @fileoverview VectorStore — represents semantic memory.
 *
 * This module will eventually integrate Titan embeddings (see
 * ai/models/embeddings) for vectorizing content, and CockroachDB's vector
 * search capabilities for storing and querying those vectors. No embedding
 * generation or database access is implemented here — only the interface
 * and documentation for storing and searching vectors.
 */

/**
 * @typedef {Object} VectorRecord
 * @property {string} id - Unique identifier for the stored record.
 * @property {number[]} vector - The embedding vector.
 * @property {Object} metadata - Arbitrary metadata associated with the record
 *   (e.g. sessionId, sourceText, createdAt).
 */

/**
 * @typedef {Object} VectorSearchResult
 * @property {string} id - Identifier of the matched record.
 * @property {number} score - Similarity score for the match.
 * @property {Object} metadata - Metadata associated with the matched record.
 */

class VectorStore {
  /**
   * Stores a vector and its associated metadata.
   *
   * @param {number[]} vector - The embedding vector to store.
   * @param {Object} metadata - Metadata to associate with the vector.
   * @returns {Promise<VectorRecord>} The stored record.
   */
  async storeVector(vector, metadata) {
    throw new Error('Not implemented');
  }

  /**
   * Searches for vectors similar to the given query vector.
   *
   * @param {number[]} queryVector - The vector to search against.
   * @param {Object} [options] - Search options (e.g. top K, metadata filters).
   * @returns {Promise<VectorSearchResult[]>} The matching records, ranked by similarity.
   */
  async searchVectors(queryVector, options) {
    throw new Error('Not implemented');
  }

  /**
   * Deletes stored vectors matching the given criteria.
   *
   * @param {Object} criteria - Criteria describing which vectors to delete
   *   (e.g. { sessionId }).
   * @returns {Promise<void>}
   */
  async deleteVectors(criteria) {
    throw new Error('Not implemented');
  }
}

module.exports = VectorStore;