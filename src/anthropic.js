const Anthropic = require('@anthropic-ai/sdk');
const { loadConfig, loadTemplate } = require('./config');

/**
 * Generate an enhanced commit message using Claude Sonnet
 * @param {string} originalMessage - The original commit message from the user
 * @param {string} diff - The git diff of staged changes
 * @param {string} multiLineInstruction - Optional instruction for multi-line commits
 * @returns {Promise<string>} The AI-generated commit message
 */
async function generateCommitMessage(originalMessage, diff, multiLineInstruction = '') {
  const config = loadConfig();
  const templateResult = loadTemplate();

  const client = new Anthropic({
    apiKey: config.anthropicApiKey
  });

  // Build the prompt by combining template with actual data
  const prompt = templateResult.content
    .replace('{{ORIGINAL_MESSAGE}}', originalMessage)
    .replace('{{DIFF}}', diff)
    .replace('{{MULTI_LINE_INSTRUCTION}}', multiLineInstruction);

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are a helpful assistant that generates clear, informative git commit messages. You respond only with the commit message itself, no explanations or markdown formatting.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const text = message.content[0]?.text;

    if (!text) {
      throw new Error('No response received from Claude Sonnet');
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
