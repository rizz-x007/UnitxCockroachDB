/**
 * @fileoverview SemanticSearch — coordinates the query pipeline:
 *
 *   User Query -> embeddingService -> VectorStore similarity search -> Matching Listings
 *
 * This is retrieval only. It never calls a reasoning/LLM provider — its job
 * ends at returning ranked listings with similarity scores. Any use of an
 * LLM to summarize, re-rank, or explain results belongs to the orchestrator,
 * not here.
 */

class SemanticSearch {
  /**
   * @param {Object} dependencies
   * @param {import('./embeddingService')} dependencies.embeddingService - Used
   *   to embed the incoming query.
   * @param {import('../memory/vectorStore')} dependencies.vectorStore - Used
   *   to find listings with the nearest embeddings.
   */
  constructor({ embeddingService, vectorStore }) {
    if (!embeddingService || !vectorStore) {
      throw new Error('SemanticSearch requires embeddingService and vectorStore');
    }

    /** @type {import('./embeddingService')} */
    this.embeddingService = embeddingService;

    /** @type {import('../memory/vectorStore')} */
    this.vectorStore = vectorStore;
  }

  /**
   * Finds listings semantically relevant to a user's query.
   *
   * @param {string} query - The user's search query text.
   * @param {Object} [options]
   * @param {number} [options.topK] - Maximum number of results to return.
   * @param {number} [options.minScore] - Minimum similarity score to include a result.
   * @returns {Promise<import('../memory/vectorStore').ListingSearchResult[]>}
   *   Matching listings, ranked by similarity score.
   */
  async search(query, options = {}) {
    const queryVector = await this.embeddingService.embedQuery(query);
    return this.vectorStore.similaritySearch(queryVector, options);
  }
}

module.exports = SemanticSearch;