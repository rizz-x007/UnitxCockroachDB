/**
 * @fileoverview ListingIndexer — coordinates the full indexing pipeline for
 * a marketplace listing:
 *
 *   format -> embed -> store vector
 *
 * Formatting and embedding are already encapsulated inside EmbeddingService
 * (via embedListing, which internally uses ListingFormatter), so this
 * module does not duplicate that logic — it simply sequences
 * "embed this listing" -> "store the resulting vector", and exposes that as
 * a small, orchestrator-friendly API.
 */

class ListingIndexer {
  /**
   * @param {Object} dependencies
   * @param {import('./embeddingService')} dependencies.embeddingService - Used
   *   to turn a listing into an embedding (formatting happens inside it).
   * @param {import('../memory/vectorStore')} dependencies.vectorStore - Used
   *   to persist/remove the resulting vector.
   */
  constructor({ embeddingService, vectorStore }) {
    if (!embeddingService || !vectorStore) {
      throw new Error('ListingIndexer requires embeddingService and vectorStore');
    }

    /** @type {import('./embeddingService')} */
    this.embeddingService = embeddingService;

    /** @type {import('../memory/vectorStore')} */
    this.vectorStore = vectorStore;
  }

  /**
   * Indexes a new listing: embeds it and stores the resulting vector.
   *
   * @param {import('./listingFormatter').Listing} listing - The listing to index.
   *   Must include an `id`.
   * @returns {Promise<void>}
   */
  async indexListing(listing) {
    if (!listing || !listing.id) {
      throw new Error('indexListing requires a listing with an id');
    }

    const embedding = await this.embeddingService.embedListing(listing);
    await this.vectorStore.upsertListingEmbedding(listing.id, embedding, buildMetadata(listing));
  }

  /**
   * Re-indexes an existing listing (e.g. after an edit). Equivalent to
   * indexListing — the upsert in vectorStore handles both insert and update.
   *
   * @param {import('./listingFormatter').Listing} listing - The updated listing.
   *   Must include an `id`.
   * @returns {Promise<void>}
   */
  async updateListing(listing) {
    return this.indexListing(listing);
  }

  /**
   * Removes a listing from semantic memory (e.g. after it's sold/deleted).
   *
   * @param {string} listingId - The listing's unique identifier.
   * @returns {Promise<void>}
   */
  async removeListing(listingId) {
    if (!listingId) {
      throw new Error('removeListing requires a listingId');
    }
    await this.vectorStore.deleteListingEmbedding(listingId);
  }
}

/**
 * Builds the metadata object stored alongside a listing's vector, used to
 * enrich similarity-search results without a second lookup.
 *
 * @param {import('./listingFormatter').Listing} listing
 * @returns {Object}
 */
function buildMetadata(listing) {
  return {
    title: listing.title,
    category: listing.category,
    price: listing.price,
    condition: listing.condition,
  };
}

module.exports = ListingIndexer;