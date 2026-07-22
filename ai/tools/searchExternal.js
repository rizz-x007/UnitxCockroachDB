/**
 * @fileoverview SearchExternalTool — placeholder for future external
 * marketplace search (e.g. Amazon, Flipkart) used for price/product
 * comparison against UniThrift listings.
 *
 * Not implemented for now — no HTTP calls are included here, only the
 * interface and documentation.
 */

/**
 * @typedef {Object} ExternalProduct
 * @property {string} source - The external marketplace name (e.g. "amazon", "flipkart").
 * @property {string} externalId - The product's identifier on the external marketplace.
 * @property {string} title - Product title.
 * @property {number} price - Product price.
 * @property {string} url - Link to the product on the external marketplace.
 */

class SearchExternalTool {
  /**
   * Searches external marketplaces for products matching a query.
   *
   * @param {string} query - The search query text.
   * @param {Object} [options] - Search options (e.g. which marketplaces to include).
   * @returns {Promise<ExternalProduct[]>} Matching external products.
   */
  async search(query, options) {
    throw new Error('Not implemented');
  }
}

module.exports = SearchExternalTool;