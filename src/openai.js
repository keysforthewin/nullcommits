const OpenAI = require('openai');
const { loadConfig, loadTemplate } = require('./config');

/**
 * Generate an enhanced commit message using GPT-5.1
 * @param {string} originalMessage - The original commit message from the user
 * @param {string} diff - The git diff of staged changes
 * @returns {Promise<string>} The AI-generated commit message
 */
async function generateCommitMessage(originalMessage, diff) {
  const config = loadConfig();
  const templateResult = loadTemplate();

  const openai = new OpenAI({
    apiKey: config.apiKey
  });

  // Build the prompt by combining template with actual data
  const prompt = templateResult.content
    .replace('{{ORIGINAL_MESSAGE}}', originalMessage)
    .replace('{{DIFF}}', diff);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates clear, informative git commit messages. You respond only with the commit message itself, no explanations or markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const message = completion.choices[0]?.message?.content;
    
    if (!message) {
      throw new Error('No response received from GPT-5.1');
    }

    // Clean up the message - remove any quotes if AI wrapped it
    return message.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    }
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your billing.');
    }
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

module.exports = {
  generateCommitMessage
};