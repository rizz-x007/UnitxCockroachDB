/**
 * @fileoverview Reusable prompt templates for the AI workflow.
 *
 * These are placeholder templates. Marketplace-specific rules and detailed
 * instructions will be added later — for now these exist to establish where
 * prompt text lives and how it will be referenced by the orchestrator.
 */

/**
 * The base system prompt used to set overall assistant behavior.
 * @type {string}
 */
const SYSTEM_PROMPT = 'You are an assistant. (Placeholder system prompt — to be defined.)';

/**
 * Prompt used when helping a user find or evaluate items to purchase.
 * @type {string}
 */
const SHOPPING_PROMPT = 'You are helping a user shop. (Placeholder shopping prompt — to be defined.)';

/**
 * Prompt used when comparing two or more items/listings.
 * @type {string}
 */
const COMPARISON_PROMPT = 'You are comparing items. (Placeholder comparison prompt — to be defined.)';

module.exports = {
  SYSTEM_PROMPT,
  SHOPPING_PROMPT,
  COMPARISON_PROMPT,
};