const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require('@aws-sdk/client-bedrock-runtime');
const EmbeddingProvider = require('./provider');

/**
 * @fileoverview Amazon Titan implementation of {@link EmbeddingProvider}.
 * Bedrock's InvokeModel API. Titan V2 embeds one text per request — there is
 * no native batch endpoint — so {@link TitanEmbeddingProvider#embedBatch}
 * fans out individual embedText calls with bounded concurrency rather than

 */

const DEFAULT_MODEL_ID = 'amazon.titan-embed-text-v2:0';
const VALID_DIMENSIONS = [256, 512, 1024];
const DEFAULT_DIMENSIONS = 1024;
const DEFAULT_BATCH_CONCURRENCY = 5;

class TitanEmbeddingProvider extends EmbeddingProvider {
  /**
   * @param {Object} [config]
   * @param {string} [config.region] - AWS region. Defaults to AWS_REGION env
   *   var, then "us-east-1".
   * @param {string} [config.modelId] - Bedrock model ID. Defaults to
   *   "amazon.titan-embed-text-v2:0".
   * @param {number} [config.dimensions] - Output embedding size. Titan V2
   *   supports 256, 512, or 1024. Defaults to 1024.
   * @param {number} [config.batchConcurrency] - Max concurrent requests used
   *   by embedBatch. Defaults to 5.
   */
  constructor({ region, modelId, dimensions, batchConcurrency } = {}) {
    super();

    if (dimensions !== undefined && !VALID_DIMENSIONS.includes(dimensions)) {
      throw new Error(
        `Invalid Titan embedding dimensions: ${dimensions}. Must be one of ${VALID_DIMENSIONS.join(', ')}`
      );
    }

    /** @type {BedrockRuntimeClient} */
    this.client = new BedrockRuntimeClient({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });

    /** @type {string} */
    this.modelId = modelId || process.env.TITAN_EMBEDDING_MODEL_ID || DEFAULT_MODEL_ID;

    /** @type {number} */
    this.dimensions = dimensions || DEFAULT_DIMENSIONS;

    /** @type {number} */
    this.batchConcurrency = batchConcurrency || DEFAULT_BATCH_CONCURRENCY;
  }

  /**
   * @inheritdoc
   */
  async embedText(text) {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('embedText requires a non-empty string');
    }

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text,
        dimensions: this.dimensions,
        normalize: true,
      }),
    });

    const response = await this.client.send(command);
    const payload = JSON.parse(Buffer.from(response.body).toString('utf-8'));

    if (!Array.isArray(payload.embedding)) {
      throw new Error('Titan response did not include an embedding array');
    }

    // The API is asked to normalize, but we defensively re-normalize
    // client-side in case a future model version omits the flag's effect.
    return normalizeVector(payload.embedding);
  }

  /**
   * @inheritdoc
   */
  async embedBatch(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    const results = new Array(texts.length);
    let cursor = 0;

    // Simple bounded-concurrency worker pool — Titan V2 has no native batch
    // endpoint, so this avoids firing unbounded parallel requests while
    // still being faster than a strict sequential loop.
    const worker = async () => {
      while (cursor < texts.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await this.embedText(texts[index]);
      }
    };

    const workers = Array.from(
      { length: Math.min(this.batchConcurrency, texts.length) },
      () => worker()
    );
    await Promise.all(workers);

    return results;
  }
}

/**
 *
 * @param {number[]} vector
 * @returns {number[]}
 */
function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}

module.exports = TitanEmbeddingProvider;