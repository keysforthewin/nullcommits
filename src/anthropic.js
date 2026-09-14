const Anthropic = require('@anthropic-ai/sdk');
const { loadConfig, loadTemplate } = require('./config');
const { FULL_SYSTEM_PROMPT, fillTemplate, cleanMessage } = require('./prompt');
const { ProviderExhaustedError, ProviderUnavailableError } = require('./cli-provider');

/**
 * Whether this provider can be attempted.
 * @param {Object} config
 * @returns {boolean}
 */
function isConfigured(config) {
  return Boolean(config.anthropicApiKey);
}

/**
 * Placeholders that hold per-commit (volatile) data. Everything in the template
 * before the earliest of these is treated as stable instructions and cached;
 * everything from there on is the volatile tail (original message + diff) and
 * is left uncached. Keep these data placeholders at the END of custom templates
 * to get the most caching.
 */
const DATA_PLACEHOLDERS = ['{{MULTI_LINE_INSTRUCTION}}', '{{ORIGINAL_MESSAGE}}', '{{DIFF}}'];

/**
 * Split a template into its stable instruction prefix and its volatile data
 * tail. The split point is the earliest data placeholder; everything before it
 * is byte-identical across commits (cacheable), everything after varies.
 * @param {string} template
 * @returns {{instructions: string, data: string}}
 */
function splitTemplate(template) {
  let splitIndex = template.length;
  for (const placeholder of DATA_PLACEHOLDERS) {
    const idx = template.indexOf(placeholder);
    if (idx !== -1 && idx < splitIndex) {
      splitIndex = idx;
    }
  }
  return {
    instructions: template.slice(0, splitIndex),
    data: template.slice(splitIndex)
  };
}

/**
 * Generate an enhanced commit message using the Anthropic API (pay-as-you-go
 * fallback). The stable system prompt + template instructions are marked for
 * prompt caching so repeated commits only pay for the diff.
 * @param {string} originalMessage - The original commit message from the user
 * @param {string} diff - The git diff of staged changes
 * @param {string} multiLineInstruction - Optional instruction for multi-line commits
 * @returns {Promise<string>} The AI-generated commit message
 */
async function generateCommitMessage(originalMessage, diff, multiLineInstruction = '') {
  const config = loadConfig();
  if (!config.anthropicApiKey) {
    throw new ProviderUnavailableError('No Anthropic API key configured');
  }
  const templateResult = loadTemplate();
  const model = config.anthropicModel;

  const client = new Anthropic({
    apiKey: config.anthropicApiKey
  });

  // Split the template so the stable instructions can be cached while only the
  // volatile per-commit data (original message + diff) is sent uncached.
  const { instructions, data } = splitTemplate(templateResult.content);
  const volatile = fillTemplate(data, originalMessage, diff, multiLineInstruction);

  // Cache prefix #1: the system prompt + authorship policy. The authorship
  // policy is appended unconditionally so it applies no matter which template
  // (local, global, or bundled) is in use and cannot be overridden away — and
  // living in the system block makes it even harder for a template to override.
  const system = [
    {
      type: 'text',
      text: FULL_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' }
    }
  ];

  // The user turn: cache prefix #2 is the stable template instructions; the
  // final block holds only the volatile diff/message and is never cached.
  const content = [];
  if (instructions.trim()) {
    content.push({
      type: 'text',
      text: instructions,
      cache_control: { type: 'ephemeral' }
    });
  }
  content.push({ type: 'text', text: volatile });

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: [
        {
          role: 'user',
          content
        }
      ]
    });

    const text = cleanMessage(message.content[0]?.text);

    if (!text) {
      throw new Error('No response received from Claude');
    }

    return text;
  } catch (error) {
    if (error.status === 401) {
      throw new ProviderUnavailableError('Invalid Anthropic API key. Please check your configuration.');
    }
    if (error.status === 429 || error.status === 402 || /credit balance|billing/i.test(error.message || '')) {
      throw new ProviderExhaustedError(`Anthropic API rate limit or credit exhausted: ${error.message}`);
    }
    throw new Error(`Anthropic API error: ${error.message}`);
  }
}

module.exports = {
  generateCommitMessage,
  isConfigured
};
