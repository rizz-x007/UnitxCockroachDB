/**
 * @fileoverview ListingFormatter — converts a marketplace listing object
 * into a single plain-text semantic document, optimized for generating
 * embeddings.
 *
 * This is the first stage of the embedding pipeline:
 *
 *   Listing Object -> listingFormatter -> embeddingService -> TitanEmbeddingProvider -> VectorStore
 *
 * It performs no I/O and has no dependency on any provider or store — it is
 * a pure text-transformation step, kept separate so formatting rules can
 * evolve independently of how (or where) embeddings are generated.
 */

/**
 * @typedef {Object} Listing
 * @property {string} id - Unique listing identifier.
 * @property {string} title - Listing title.
 * @property {string} category - Listing category.
 * @property {string} description - Listing description (may contain HTML/markdown).
 * @property {string} condition - Item condition (e.g. "new", "used").
 * @property {number} price - Listing price.
 * @property {string} [university] - University associated with the listing.
 * @property {string} [campus] - Campus associated with the listing.
 * @property {string} [location] - Free-text pickup/meetup location.
 * @property {boolean} [sellerVerified] - Whether the seller is verified.
 * @property {number} [sellerRating] - Seller's average rating.
 * @property {string[]} [tags] - Free-form tags/keywords for the listing.
 */

/**
 * Maximum length, in characters, of the formatted document returned by
 * {@link ListingFormatter#format}. Keeps requests to the embedding provider
 * bounded regardless of how long a listing's description is.
 * @type {number}
 */
const MAX_DOCUMENT_LENGTH = 2000;

class ListingFormatter {
  /**
   * @param {Object} [config]
   * @param {number} [config.maxLength] - Overrides the default maximum
   *   output length in characters.
   */
  constructor({ maxLength } = {}) {
    /** @type {number} */
    this.maxLength = maxLength || MAX_DOCUMENT_LENGTH;
  }

  /**
   * Converts a listing into a single plain-text semantic document suitable
   * for embedding. Strips HTML/markdown from free-text fields and truncates
   * the result to `this.maxLength` characters.
   *
   * @param {Listing} listing - The listing to format.
   * @returns {string} The formatted semantic document.
   */
  format(listing) {
    if (!listing || typeof listing !== 'object') {
      throw new Error('format requires a listing object');
    }

    const lines = [
      formatField('Title', stripMarkup(listing.title)),
      formatField('Category', listing.category),
      formatField('Description', stripMarkup(listing.description)),
      formatField('Condition', listing.condition),
      formatField('Price', formatPrice(listing.price)),
      formatField('University', listing.university),
      formatField('Campus', listing.campus),
      formatField('Location', listing.location),
      formatField('Seller verification', formatSellerVerification(listing.sellerVerified)),
      formatField('Seller rating', formatSellerRating(listing.sellerRating)),
      formatField('Tags', formatTags(listing.tags)),
    ].filter(Boolean);

    const document = lines.join('\n');
    return truncate(document, this.maxLength);
  }
}

/**
 * Formats a single "Label: value" line, omitting the line entirely if the
 * value is empty/undefined.
 *
 * @param {string} label
 * @param {string|undefined|null} value
 * @returns {string|null}
 */
function formatField(label, value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return `${label}: ${value}`;
}

/**
 * Removes HTML tags and common markdown syntax from free text, collapsing
 * whitespace left behind.
 *
 * @param {string|undefined|null} text
 * @returns {string}
 */
function stripMarkup(text) {
  if (!text) {
    return '';
  }

  return text
    .replace(/<[^>]*>/g, ' ') // HTML tags
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ') // inline/fenced code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // markdown images
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ') // markdown links -> drop URL, keep spacing
    .replace(/[*_#>~-]/g, ' ') // markdown emphasis/heading/quote/list markers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {number|undefined|null} price
 * @returns {string}
 */
function formatPrice(price) {
  if (price === undefined || price === null || Number.isNaN(price)) {
    return '';
  }
  return `$${Number(price).toFixed(2)}`;
}

/**
 * @param {boolean|undefined} verified
 * @returns {string}
 */
function formatSellerVerification(verified) {
  if (verified === undefined || verified === null) {
    return '';
  }
  return verified ? 'Verified seller' : 'Unverified seller';
}

/**
 * @param {number|undefined|null} rating
 * @returns {string}
 */
function formatSellerRating(rating) {
  if (rating === undefined || rating === null || Number.isNaN(rating)) {
    return '';
  }
  return `${Number(rating).toFixed(1)} / 5`;
}

/**
 * @param {string[]|undefined|null} tags
 * @returns {string}
 */
function formatTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  return tags.join(', ');
}

/**
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trim();
}

module.exports = ListingFormatter;