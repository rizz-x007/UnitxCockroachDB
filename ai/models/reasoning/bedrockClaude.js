const {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} = require('@aws-sdk/client-bedrock-runtime');

/**
 * @fileoverview Amazon Bedrock (Claude) implementation of the ReasoningProvider
 * interface (see ./provider.js for the interface definition).
 *
 * Uses Bedrock's Converse Stream API, which is Anthropic-model-agnostic
 * (works the same way across Claude versions) and gives token-level
 * streaming for free.
 *
 * Credentials are picked up the standard AWS SDK way (env vars, shared
 * config/credentials file, or an attached IAM role) — nothing is hardcoded
 * here.
 *
 * @implements {import('./provider').ReasoningProvider}
 */

class BedrockClaudeProvider {
  /**
   * @param {Object} [config]
   * @param {string} [config.region] - AWS region. Defaults to AWS_REGION env
   *   var, then "us-east-1".
   * @param {string} [config.modelId] - Bedrock model ID to invoke. Defaults
   *   to BEDROCK_CLAUDE_MODEL_ID env var, then a Claude 3.5 Sonnet model ID.
   */
  constructor({ region, modelId } = {}) {
    /** @type {BedrockRuntimeClient} */
    this.client = new BedrockRuntimeClient({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });

    /** @type {string} */
    this.modelId =
      modelId ||
      process.env.BEDROCK_CLAUDE_MODEL_ID ||
      'anthropic.claude-3-5-sonnet-20240620-v1:0';
  }

  /**
   * Streams a response for a multi-turn conversation.
   *
   * @param {Array<{role: string, content: string}>} messages - The conversation
   *   history, ordered oldest to newest. Roles should be "user" or "assistant".
   * @param {Object} [options] - Generation options.
   * @param {number} [options.maxTokens=1024] - Maximum tokens to generate.
   * @param {number} [options.temperature=0.7] - Sampling temperature.
   * @param {string} [options.systemPrompt] - Optional system prompt.
   * @returns {AsyncIterable<string>} An async iterable yielding text chunks
   *   as they arrive.
   */
  async *stream(messages, options = {}) {
    const { maxTokens = 1024, temperature = 0.7, systemPrompt } = options;

    const command = new ConverseStreamCommand({
      modelId: this.modelId,
      messages: messages.map((m) => ({
        role: m.role,
        content: [{ text: m.content }],
      })),
      ...(systemPrompt ? { system: [{ text: systemPrompt }] } : {}),
      inferenceConfig: { maxTokens, temperature },
    });

    const response = await this.client.send(command);

    for await (const event of response.stream) {
      const text = event.contentBlockDelta?.delta?.text;
      if (text) {
        yield text;
      }
    }
  }

  /**
   * Indicates whether this provider/model supports tool calling.
   *
   * Claude models on Bedrock support tool use via the Converse API.
   *
   * @returns {boolean}
   */
  supportsToolCalling() {
    return true;
  }
}

module.exports = BedrockClaudeProvider;