/**
 * @fileoverview SearchProductsTool — searches UniThrift listings and returns
 * structured product data.
 *
 * This tool must never call an LLM. It is a pure data-retrieval tool that
 * the orchestrator/reasoning providers can invoke via the tool-calling
 * interface (see ai/core/toolRegistry.js).
 *
 * No query implementation (SQL, CockroachDB, HTTP, etc.) is included here —
 * only the interface and documentation.
 */

/**
 * @typedef {Object} ProductSearchFilters
 * @property {string} [category] - Restrict results to a category.
 * @property {number} [minPrice] - Minimum price filter.
 * @property {number} [maxPrice] - Maximum price filter.
 * @property {string} [condition] - Item condition filter (e.g. "new", "used").
 * @property {string} [location] - Location/campus filter.
 */

/**
 * @typedef {Object} Product
 * @property {string} id - Unique listing identifier.
 * @property {string} title - Listing title.
 * @property {string} description - Listing description.
 * @property {number} price - Listing price.
 * @property {string} condition - Item condition.
 * @property {string} sellerId - Identifier of the selling user.
 * @property {string[]} images - Image URLs for the listing.
 */

class SearchProductsTool {
  /**
   * Searches UniThrift listings matching a query and optional filters.
   *
   * @param {string} query - The search query text.
   * @param {ProductSearchFilters} [filters] - Optional filters to narrow results.
   * @returns {Promise<Product[]>} Matching products.
   */
  async search(query, filters) {
    throw new Error('Not implemented');
  }
}

module.exports = SearchProductsTool;