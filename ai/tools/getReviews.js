/**
 * @fileoverview GetReviewsTool — retrieves reviews for products or sellers.
 *
 * No database queries or HTTP calls are included here — only the interface
 * and documentation.
 */

/**
 * @typedef {Object} Review
 * @property {string} id - Unique review identifier.
 * @property {string} targetId - Identifier of the product or seller being reviewed.
 * @property {string} targetType - Either "product" or "seller".
 * @property {string} authorId - Identifier of the user who wrote the review.
 * @property {number} rating - Numeric rating given.
 * @property {string} text - Review text content.
 * @property {string} createdAt - ISO timestamp of when the review was created.
 */

class GetReviewsTool {
  /**
   * Retrieves reviews for a given product or seller.
   *
   * @param {string} targetId - Identifier of the product or seller.
   * @param {"product"|"seller"} targetType - Which type of entity the reviews are for.
   * @returns {Promise<Review[]>} The matching reviews.
   */
  async getReviews(targetId, targetType) {
    throw new Error('Not implemented');
  }
}

module.exports = GetReviewsTool;