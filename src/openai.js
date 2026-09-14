const OpenAI = require('openai');
const { loadConfig } = require('./config');
const { buildPrompt, cleanMessage } = require('./prompt');
const { ProviderExhaustedError, ProviderUnavailableError } = require('./cli-provider');

/**
 * Whether this provider can be attempted.
 * @param {Object} config
 * @returns {boolean}
 */
function isConfigured(config) {
  return Boolean(config.apiKey);
}

/**
 * Generate an enhanced commit message using the OpenAI API (pay-as-you-go
 * fallback). Model defaults to a cheap tier; see DEFAULT_OPENAI_MODEL.
 * @param {string} originalMessage - The original commit message from the user
 * @param {string} diff - The git diff of staged changes
 * @param {string} multiLineInstruction - Optional instruction for multi-line commits
 * @returns {Promise<string>} The AI-generated commit message
 */
async function generateCommitMessage(originalMessage, diff, multiLineInstruction = '') {
  const config = loadConfig();
  if (!config.apiKey) {
    throw new ProviderUnavailableError('No OpenAI API key configured');
  }
  const { system, user } = buildPrompt(originalMessage, diff, multiLineInstruction);
  const model = config.openaiModel;

  const openai = new OpenAI({ apiKey: config.apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    });

    const message = cleanMessage(completion.choices[0]?.message?.content);

    if (!message) {
      throw new Error(`No response received from ${model}`);
    }

    return message;
  } catch (error) {
    if (error.code === 'invalid_api_key' || error.status === 401) {
      throw new ProviderUnavailableError('Invalid OpenAI API key. Please check your configuration.');
    }
    if (error.code === 'insufficient_quota' || error.status === 429) {
      throw new ProviderExhaustedError(`OpenAI API quota/rate limit exceeded: ${error.message}`);
    }
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

module.exports = {
  generateCommitMessage,
  isConfigured
};
