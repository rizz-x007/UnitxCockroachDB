const { Pool } = require('pg');

/**
 * @fileoverview VectorStore — represents semantic memory.
 *
 * Backed by CockroachDB (Postgres-wire-compatible), accessed via `pg`. All
 * SQL lives inside this file — callers (embeddingService, listingIndexer,
 * semanticSearch) only ever see plain JS method calls and never construct
 * or see a query.
 *
 * Listing embeddings are stored in a `listing_embeddings` table, assumed to
 * have this shape:
 *
 *   CREATE TABLE listing_embeddings (
 *     listing_id STRING PRIMARY KEY,
 *     embedding  VECTOR(1024) NOT NULL,
 *     metadata   JSONB NOT NULL DEFAULT '{}',
 *     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 * Vectors are expected to already be L2-normalized (TitanEmbeddingProvider
 * normalizes before returning). We utilize `<=>` (Cosine distance) for
 * native, mathematically exact similarity search calculations.
 *
 * CockroachDB's native vector-search operator/index syntax is still
 * evolving across versions — confirm `<=>` and any vector index syntax
 * against the specific CockroachDB version in use before relying on this
 * in production.
 */

const DEFAULT_TABLE = 'listing_embeddings';
const DEFAULT_TOP_K = 10;

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

/**
 * @typedef {Object} ListingSearchResult
 * @property {string} listingId - Identifier of the matched listing.
 * @property {number} score - Similarity score in [0, 1], where 1 is an
 *   exact match (derived from normalized-vector distance).
 * @property {Object} metadata - Metadata stored alongside the listing's embedding.
 */

class VectorStore {
  /**
   * @param {Object} [config]
   * @param {string} [config.connectionString] - CockroachDB connection
   *   string. Defaults to the COCKROACHDB_URL env var.
   * @param {string} [config.table] - Table name for listing embeddings.
   *   Defaults to "listing_embeddings".
   * @param {import('pg').Pool} [config.pool] - An explicit pg Pool to use
   *   instead of creating one. Useful for tests (inject a mock pool).
   */
  constructor({ connectionString, table, pool } = {}) {
    /** @type {string} */
    this.table = table || DEFAULT_TABLE;

    /** @type {import('pg').Pool} */
    this.pool =
      pool ||
      new Pool({
        connectionString: connectionString || process.env.COCKROACHDB_URL,
      });
  }

  /**
   * Inserts a listing's embedding, or updates it if one already exists for
   * that listing ID.
   *
   * @param {string} listingId - The listing's unique identifier.
   * @param {number[]} embedding - The (normalized) embedding vector.
   * @param {Object} [metadata] - Arbitrary metadata to store alongside the
   *   vector (e.g. denormalized fields useful for filtering/display in
   *   search results).
   * @returns {Promise<void>}
   */
  async upsertListingEmbedding(listingId, embedding, metadata = {}) {
    if (!listingId) {
      throw new Error('upsertListingEmbedding requires a listingId');
    }
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('upsertListingEmbedding requires a non-empty embedding vector');
    }

    const query = `
      INSERT INTO ${this.table} (listing_id, embedding, metadata, updated_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (listing_id)
      DO UPDATE SET embedding = EXCLUDED.embedding,
                     metadata = EXCLUDED.metadata,
                     updated_at = now()
    `;

    await this.pool.query(query, [listingId, toVectorLiteral(embedding), JSON.stringify(metadata)]);
  }

  /**
   * Deletes a listing's stored embedding.
   *
   * @param {string} listingId - The listing's unique identifier.
   * @returns {Promise<void>}
   */
  async deleteListingEmbedding(listingId) {
    if (!listingId) {
      throw new Error('deleteListingEmbedding requires a listingId');
    }

    const query = `DELETE FROM ${this.table} WHERE listing_id = $1`;
    await this.pool.query(query, [listingId]);
  }

  /**
   * Finds listings whose stored embedding is nearest to the given query
   * vector using native cosine distance.
   *
   * @param {number[]} queryVector - The (normalized) query embedding.
   * @param {Object} [options]
   * @param {number} [options.topK=10] - Maximum number of results to return.
   * @param {number} [options.minScore] - If provided, filters out results
   *   below this similarity score.
   * @returns {Promise<ListingSearchResult[]>} Matching listings, ranked by similarity.
   */
  async similaritySearch(queryVector, options = {}) {
    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      throw new Error('similaritySearch requires a non-empty query vector');
    }

    const topK = options.topK || DEFAULT_TOP_K;

    // Use CockroachDB's native Cosine Distance operator <=>
    const query = `
      SELECT listing_id, metadata, embedding <=> $1 AS distance
      FROM ${this.table}
      ORDER BY embedding <=> $1
      LIMIT $2
    `;

    const { rows } = await this.pool.query(query, [toVectorLiteral(queryVector), topK]);

    const results = rows.map((row) => ({
      listingId: row.listing_id,
      // Cosine Similarity = 1 - Cosine Distance
      // For exact matches, Cosine Distance is 0, returning a score of 1.
      score: 1 - Number(row.distance),
      metadata: row.metadata,
    }));

    if (options.minScore === undefined) {
      return results;
    }
    return results.filter((result) => result.score >= options.minScore);
  }

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

/**
 * Formats a JS number array as the string literal CockroachDB's VECTOR type
 * expects (e.g. "[0.1,0.2,0.3]").
 *
 * @param {number[]} vector
 * @returns {string}
 */
function toVectorLiteral(vector) {
  return `[${vector.join(',')}]`;
}

module.exports = VectorStore;