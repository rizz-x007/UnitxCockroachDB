/**
 * @fileoverview Google Gemini implementation of the ModerationProvider interface
 * (see ./provider.js for the interface definition).
 *
 * This is a placeholder skeleton only — no API calls have been implemented yet.
 *
 * @implements {import('./provider').ModerationProvider}
 */

class GeminiModerationProvider {
  /**
   * Analyzes a user-submitted review for policy violations.
   *
   * @param {string} reviewText - The review content to analyze.
   * @returns {Promise<import('./provider').ModerationResult>}
   */
  async analyzeReview(reviewText) {
    throw new Error('Not implemented');
  }

  /**
   * Checks a marketplace listing for policy violations.
   *
   * @param {Object} listing - The listing to check (title, description, images, price, etc.).
   * @returns {Promise<import('./provider').ModerationResult>}
   */
  async checkListing(listing) {
    throw new Error('Not implemented');
  }
}

module.exports = GeminiModerationProvider;