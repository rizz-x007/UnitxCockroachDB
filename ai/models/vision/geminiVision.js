/**
 * @fileoverview Google Gemini implementation of the VisionProvider interface
 * (see ./provider.js for the interface definition).
 *
 * This is a placeholder skeleton only — no API calls have been implemented yet.
 *
 * @implements {import('./provider').VisionProvider}
 */

class GeminiVisionProvider {
  /**
   * Verifies a listing image against the listing's stated details and checks
   * for prohibited or misleading content.
   *
   * @param {Buffer|string} image - Image data as a Buffer, URL, or base64 string.
   * @param {Object} [listing] - The listing metadata to verify against
   *   (e.g. title, description, condition, category).
   * @returns {Promise<import('./provider').ListingVerificationResult>}
   */
  async verifyListing(image, listing) {
    throw new Error('Not implemented');
  }
}

module.exports = GeminiVisionProvider;