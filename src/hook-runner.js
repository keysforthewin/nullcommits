const fs = require('fs');
const { getSmartStagedDiff } = require('./git');
const { generateCommitMessage: generateWithAnthropic } = require('./anthropic');
const { generateCommitMessage: generateWithOpenAI } = require('./openai');
const { getDiffBudget, loadConfig } = require('./config');

/**
 * Multi-line commit instruction to inject when there are many changes
 */
const MULTI_LINE_INSTRUCTION = `
⚠️ IMPORTANT: This commit has significant changes (10+ lines modified).
You MUST create a multi-line commit message with:
- A concise summary line (max 72 chars) with emoji
- A blank line
- A detailed body explaining what changed in EACH file
- Use bullet points for clarity
- Explain WHY each change was made, not just what changed
`;

/**
 * Process a commit message file - called by the git hook
 * @param {string} msgFile - Path to the commit message file
 */
async function processCommitMessage(msgFile) {
  // Read the original commit message
  if (!fs.existsSync(msgFile)) {
    throw new Error(`Commit message file not found: ${msgFile}`);
  }

  const originalMessage = fs.readFileSync(msgFile, 'utf-8').trim();

  // Skip if it looks like a merge commit or other special commit
  if (originalMessage.startsWith('Merge ') ||
      originalMessage.startsWith('Revert ') ||
      originalMessage.startsWith('Human:') ||
      originalMessage.startsWith('fixup!') ||
      originalMessage.startsWith('squash!')) {
    // Don't modify special commits
    return;
  }

  // Get the staged diff with intelligent budget allocation
  const diffBudget = getDiffBudget();
  const { diff, totalLinesChanged, fileCount } = getSmartStagedDiff(diffBudget);
  
  if (!diff.trim()) {
    console.log('⚠️  No changes detected in diff. Using original message.');
    return;
  }

  // Determine if we need multi-line commit instruction
  const requireMultiLine = totalLinesChanged > 10;
  const multiLineInstruction = requireMultiLine ? MULTI_LINE_INSTRUCTION : '';

  // Generate the enhanced message with provider fallback
  const config = loadConfig();
  let enhancedMessage;

  if (config.anthropicApiKey) {
    try {
      enhancedMessage = await generateWithAnthropic(originalMessage, diff, multiLineInstruction);
    } catch (anthropicError) {
      if (config.apiKey) {
        console.error(`⚠️  Anthropic API failed: ${anthropicError.message}`);
        console.error('   Falling back to OpenAI...');
        enhancedMessage = await generateWithOpenAI(originalMessage, diff, multiLineInstruction);
      } else {
        throw anthropicError;
      }
    }
  } else {
    enhancedMessage = await generateWithOpenAI(originalMessage, diff, multiLineInstruction);
  }
  
  // Write the enhanced message back to the file
  fs.writeFileSync(msgFile, enhancedMessage, 'utf-8');
}

module.exports = {
  processCommitMessage,
  MULTI_LINE_INSTRUCTION
};