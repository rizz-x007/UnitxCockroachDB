/**
 * @fileoverview Base interface for embedding providers.
 *
 * Embedding providers convert text into numeric vector representations
 * used for semantic search, similarity comparison, and memory storage.
 * Concrete providers (e.g. Titan) must extend this class and implement
 * all methods.
 */

class EmbeddingProvider {
  /**
   * Generates a vector embedding for a single piece of text.
   *
   * @param {string} text - The text to embed.
   * @returns {Promise<number[]>} The resulting embedding vector.
   */
  async embedText(text) {
    throw new Error('Not implemented');
  }

  /**
   * Generates vector embeddings for multiple pieces of text in a single batch.
   *
   * @param {string[]} texts - The texts to embed.
   * @returns {Promise<number[][]>} An array of embedding vectors, in the same
   *   order as the input texts.
   */
  async embedBatch(texts) {
    throw new Error('Not implemented');
  }
}

module.exports = EmbeddingProvider;