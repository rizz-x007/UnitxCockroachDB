/**
 * @fileoverview Interface definition for moderation providers.

 
 * @typedef {Object} ModerationResult
 * @property {boolean} flagged - Whether the content was flagged for violating policy.
 * @property {string[]} reasons - Human-readable reasons for the flag, if any.
 * @property {Object} categories - Category-level breakdown of the result
 *   (e.g. { scam: false, prohibitedItem: false, offensiveLanguage: false }).
 * @property {Object} raw - The raw, unprocessed response from the underlying provider.
 *
 * @typedef {Object} ModerationProvider
 * @property {function(string): Promise<ModerationResult>} analyzeReview
 * @property {function(Object): Promise<ModerationResult>} checkListing
 */

module.exports = {};