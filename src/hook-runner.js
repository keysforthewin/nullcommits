const fs = require('fs');
const { getStagedDiff } = require('./git');
const { generateCommitMessage } = require('./openai');

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
      originalMessage.startsWith('fixup!') ||
      originalMessage.startsWith('squash!')) {
    // Don't modify special commits
    return;
  }

  // Get the staged diff
  const diff = getStagedDiff();
  
  if (!diff.trim()) {
    console.log('⚠️  No changes detected in diff. Using original message.');
    return;
  }

  // Truncate diff if it's too long (to avoid token limits)
  const maxDiffLength = 8000;
  const truncatedDiff = diff.length > maxDiffLength 
    ? diff.substring(0, maxDiffLength) + '\n\n... [diff truncated for length]'
    : diff;

  // Generate the enhanced message
  const enhancedMessage = await generateCommitMessage(originalMessage, truncatedDiff);
  
  // Write the enhanced message back to the file
  fs.writeFileSync(msgFile, enhancedMessage, 'utf-8');
}

module.exports = {
  processCommitMessage
};