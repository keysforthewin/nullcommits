const { loadTemplate, AUTHORSHIP_STRIP_INSTRUCTION } = require('./config');

/**
 * Stable system prompt shared by every provider. Combined with the authorship
 * policy, this forms a prefix that never changes between commits.
 */
const SYSTEM_PROMPT = 'You are a helpful assistant that generates clear, informative git commit messages. You respond only with the commit message itself, no explanations or markdown formatting. The only author of the commit is the person making it: never add, preserve, or invent co-authorship, "Co-Authored-By"/"Signed-off-by" trailers, or any credit to another person, company, or tool. Strip all such attribution from the message.';

/**
 * Full system text: base prompt plus the mandatory authorship policy.
 */
const FULL_SYSTEM_PROMPT = SYSTEM_PROMPT + '\n' + AUTHORSHIP_STRIP_INSTRUCTION;

/**
 * Substitute the per-commit values into a template string.
 * @param {string} template
 * @param {string} originalMessage
 * @param {string} diff
 * @param {string} multiLineInstruction
 * @returns {string}
 */
function fillTemplate(template, originalMessage, diff, multiLineInstruction = '') {
  return template
    .replace('{{ORIGINAL_MESSAGE}}', originalMessage)
    .replace('{{DIFF}}', diff)
    .replace('{{MULTI_LINE_INSTRUCTION}}', multiLineInstruction);
}

/**
 * Build the system and user prompts for a commit.
 * @param {string} originalMessage
 * @param {string} diff
 * @param {string} multiLineInstruction
 * @returns {{system: string, user: string}}
 */
function buildPrompt(originalMessage, diff, multiLineInstruction = '') {
  const template = loadTemplate().content;
  return {
    system: FULL_SYSTEM_PROMPT,
    user: fillTemplate(template, originalMessage, diff, multiLineInstruction)
  };
}

/**
 * Tidy a model response: trim whitespace, drop wrapping quotes and code fences.
 * @param {string} text
 * @returns {string}
 */
function cleanMessage(text) {
  let out = String(text || '').trim();
  const fence = out.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (fence) {
    out = fence[1].trim();
  }
  return out.replace(/^["']|["']$/g, '');
}

module.exports = {
  SYSTEM_PROMPT,
  FULL_SYSTEM_PROMPT,
  fillTemplate,
  buildPrompt,
  cleanMessage
};
