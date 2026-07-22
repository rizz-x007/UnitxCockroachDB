const EmbeddingProvider = require('./provider');

/**
 * @fileoverview Amazon Titan implementation of {@link EmbeddingProvider}.
 *
 * This is a placeholder skeleton only — no API calls have been implemented yet.
 */

class TitanEmbeddingProvider extends EmbeddingProvider {
  /**
   * @inheritdoc
   */
  async embedText(text) {
    throw new Error('Not implemented');
  }

  /**
   * @inheritdoc
   */
  async embedBatch(texts) {
    throw new Error('Not implemented');
  }
}

module.exports = TitanEmbeddingProvider;