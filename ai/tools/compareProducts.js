/**
 * @fileoverview CompareProductsTool — compares multiple products.
 *
 * Initially intended to compare UniThrift listings against each other, and
 * eventually to compare a UniThrift listing against external marketplace
 * results (see ./searchExternal.js). This tool performs pure data
 * aggregation only — no LLM calls, no external HTTP calls.
 */

/**
 * @typedef {Object} ProductComparisonResult
 * @property {string[]} productIds - The identifiers of the products compared.
 * @property {Object} comparison - Aggregated comparison data (fields to be
 *   defined once comparison logic is implemented, e.g. price, condition,
 *   seller rating differences).
 * @property {Object} raw - Raw underlying product data used in the comparison.
 */

class CompareProductsTool {
  /**
   * Compares two or more products.
   *
   * @param {string[]} productIds - Identifiers of the products to compare.
   *   May include both UniThrift listing IDs and, in the future, external
   *   marketplace item identifiers.
   * @param {Object} [options] - Comparison options (e.g. which fields to compare).
   * @returns {Promise<ProductComparisonResult>} The comparison result.
   */
  async compare(productIds, options) {
    throw new Error('Not implemented');
  }
}

module.exports = CompareProductsTool;