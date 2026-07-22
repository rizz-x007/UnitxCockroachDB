/**
 * @fileoverview Interface definition for vision providers.
 *
 * There is no shared implementation between vision providers, so this file
 * documents the required method shape rather than defining a base class to
 * extend. Concrete providers (e.g. Gemini) are standalone classes that
 * implement the methods described below with matching signatures.
 *
 * @typedef {Object} ListingVerificationResult
 * @property {boolean} verified - Whether the image(s) appear consistent with
 *   the listing and comply with marketplace policy.
 * @property {string[]} reasons - Human-readable reasons for the result
 *   (e.g. "image does not match description", "prohibited item detected").
 * @property {Object} raw - The raw, unprocessed response from the underlying provider.
 *
 * @typedef {Object} VisionProvider
 * @property {function(Buffer|string, Object=): Promise<ListingVerificationResult>} verifyListing
 *   Verifies a listing image against the listing's stated details (e.g.
 *   condition, category, description) and checks for prohibited or
 *   misleading content.
 */

module.exports = {};