const { getEmbeddingProvider } = require('../models/embeddings');
const ListingFormatter = require('./listingFormatter');

/**
 * @fileoverview EmbeddingService — the provider-agnostic coordinator for
 * generating embeddings.
 *
 * This is the second stage of the embedding pipeline:
 *
 *   Listing Object -> listingFormatter -> embeddingService -> TitanEmbeddingProvider -> VectorStore
 *
 * EmbeddingService never imports a concrete provider (e.g. Titan) directly.
 * It only depends on the EmbeddingProvider interface (see
 * ai/models/embeddings/provider.js) and the provider-selection factory (see
 * ai/models/embeddings/index.js), so swapping the underlying embedding
 * model is a configuration change, not a code change here.
 */

class EmbeddingService {
  /**
   * @param {Object} [config]
   * @param {import('../models/embeddings/provider')} [config.provider] - An
   *   explicit EmbeddingProvider instance to use. Takes precedence over
   *   `providerName`. Useful for tests (inject a mock/stub provider).
   * @param {string} [config.providerName] - Name of a provider to resolve via
   *   the embeddings factory (see ai/models/embeddings/index.js). Defaults to
   *   "titan".
   * @param {Object} [config.providerConfig] - Config passed to the factory
   *   when resolving `providerName` (e.g. { region, dimensions }).
   * @param {ListingFormatter} [config.listingFormatter] - An explicit
   *   ListingFormatter instance. Defaults to a new ListingFormatter().
   */
  constructor({ provider, providerName, providerConfig, listingFormatter } = {}) {
    /** @type {import('../models/embeddings/provider')} */
    this.provider = provider || getEmbeddingProvider(providerName || 'titan', providerConfig);

    /** @type {ListingFormatter} */
    this.listingFormatter = listingFormatter || new ListingFormatter();
  }

  /**
   * Generates an embedding for a raw piece of text.
   *
   * @param {string} text - The text to embed.
   * @returns {Promise<number[]>} The resulting embedding vector.
   */
  async embed(text) {
    return this.provider.embedText(text);
  }

  /**
   * Formats a listing into a semantic document and embeds it.
   *
   * @param {import('./listingFormatter').Listing} listing - The listing to embed.
   * @returns {Promise<number[]>} The resulting embedding vector.
   */
  async embedListing(listing) {
    const document = this.listingFormatter.format(listing);
    return this.embed(document);
  }

  /**
   *
   * @param {string} query - The user's search query text.
   * @returns {Promise<number[]>} The resulting embedding vector.
   */
  async embedQuery(query) {
    if (typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('embedQuery requires a non-empty string');
    }
    return this.embed(query.trim());
  }
}

module.exports = EmbeddingService;