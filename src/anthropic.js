const Anthropic = require('@anthropic-ai/sdk');
const { loadConfig, loadTemplate, getAnthropicModel, AUTHORSHIP_STRIP_INSTRUCTION } = require('./config');

/**
 * Stable system prompt. Combined with the authorship policy, this forms the
 * cache prefix that never changes between commits, so it can be served from
 * the prompt cache on repeated requests.
 */
const SYSTEM_PROMPT = 'You are a helpful assistant that generates clear, informative git commit messages. You respond only with the commit message itself, no explanations or markdown formatting. The only author of the commit is the person making it: never add, preserve, or invent co-authorship, "Co-Authored-By"/"Signed-off-by" trailers, or any credit to another person, company, or tool. Strip all such attribution from the message.';

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
 * Generate an enhanced commit message using Claude
 * @param {string} originalMessage - The original commit message from the user
 * @param {string} diff - The git diff of staged changes
 * @param {string} multiLineInstruction - Optional instruction for multi-line commits
 * @returns {Promise<string>} The AI-generated commit message
 */
async function generateCommitMessage(originalMessage, diff, multiLineInstruction = '') {
  const config = loadConfig();
  const templateResult = loadTemplate();
  const model = config.anthropicModel || getAnthropicModel();

  const client = new Anthropic({
    apiKey: config.anthropicApiKey
  });

  // Split the template so the stable instructions can be cached while only the
  // volatile per-commit data (original message + diff) is sent uncached.
  const { instructions, data } = splitTemplate(templateResult.content);
  const volatile = data
    .replace('{{ORIGINAL_MESSAGE}}', originalMessage)
    .replace('{{DIFF}}', diff)
    .replace('{{MULTI_LINE_INSTRUCTION}}', multiLineInstruction);

  // Cache prefix #1: the system prompt + authorship policy. The authorship
  // policy is appended unconditionally so it applies no matter which template
  // (local, global, or bundled) is in use and cannot be overridden away — and
  // living in the system block makes it even harder for a template to override.
  const system = [
    {
      type: 'text',
      text: SYSTEM_PROMPT + '\n' + AUTHORSHIP_STRIP_INSTRUCTION,
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

    const text = message.content[0]?.text;

    if (!text) {
      throw new Error('No response received from Claude');
    }

    // Clean up the message - remove any quotes if AI wrapped it
    return text.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    if (error.status === 401) {
      throw new Error('Invalid Anthropic API key. Please check your configuration.');
    }
    if (error.status === 429) {
      throw new Error('Anthropic API rate limit exceeded. Please try again later.');
    }
    throw new Error(`Anthropic API error: ${error.message}`);
  }
}

module.exports = {
  generateCommitMessage
};
