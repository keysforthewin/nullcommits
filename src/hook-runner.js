const fs = require('fs');
const { getSmartStagedDiff } = require('./git');
const { getDiffBudget, loadConfig, CONFIG_FILE } = require('./config');
const { ProviderUnavailableError, ProviderExhaustedError } = require('./cli-provider');

/**
 * Provider registry. Each module exposes generateCommitMessage(original, diff,
 * multiLineInstruction) and isConfigured(config). Order of attempts comes from
 * config.providers, not from this object.
 */
const PROVIDERS = {
  'claude-code': require('./claude-code'),
  codex: require('./codex'),
  anthropic: require('./anthropic'),
  openai: require('./openai')
};

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
 * Try each configured provider in order until one returns a message.
 * Unavailable providers (no binary / no key / not logged in) are skipped
 * quietly; exhausted or failing providers log a one-line warning and fall
 * through to the next.
 * @param {Object} config
 * @param {string} originalMessage
 * @param {string} diff
 * @param {string} multiLineInstruction
 * @returns {Promise<{message: string, provider: string}>}
 */
async function generateWithFallback(config, originalMessage, diff, multiLineInstruction) {
  const failures = [];

  for (const name of config.providers) {
    const provider = PROVIDERS[name];

    if (!provider.isConfigured(config)) {
      failures.push(`${name}: not configured`);
      continue;
    }

    try {
      const message = await provider.generateCommitMessage(originalMessage, diff, multiLineInstruction);
      return { message, provider: name };
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
      if (error instanceof ProviderUnavailableError) {
        console.error(`⚠️  ${name} unavailable: ${error.message}`);
      } else if (error instanceof ProviderExhaustedError) {
        console.error(`⚠️  ${name} exhausted: ${error.message}`);
      } else {
        console.error(`⚠️  ${name} failed: ${error.message}`);
      }
    }
  }

  const configured = config.providers.some(name => PROVIDERS[name].isConfigured(config));
  if (!configured) {
    throw new Error(
      'No usable provider found!\n' +
      `Providers tried: ${config.providers.join(', ')}\n` +
      '  Subscription (preferred): install and log in to the Claude Code CLI ("claude") or Codex CLI ("codex")\n' +
      '  Anthropic API: nullcommits config set-anthropic-key YOUR_API_KEY (or ANTHROPIC_API_KEY)\n' +
      '  OpenAI API:    nullcommits config set-key YOUR_API_KEY (or OPENAI_API_KEY)\n' +
      `  Config file: ${CONFIG_FILE}   Diagnose with: nullcommits doctor`
    );
  }

  throw new Error(`All providers failed:\n  ${failures.join('\n  ')}`);
}

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

  // Only generate a message when none was provided. If the user (or a
  // coding agent) already wrote a commit message, leave it untouched.
  // Lines starting with '#' are git comments, not user content.
  const userContent = originalMessage
    .split('\n')
    .filter(line => !line.startsWith('#'))
    .join('\n')
    .trim();

  if (userContent) {
    return;
  }

  // Get the staged diff with intelligent budget allocation
  const diffBudget = getDiffBudget();
  const { diff, totalLinesChanged } = getSmartStagedDiff(diffBudget);

  if (!diff.trim()) {
    console.log('⚠️  No changes detected in diff. Using original message.');
    return;
  }

  // Determine if we need multi-line commit instruction
  const requireMultiLine = totalLinesChanged > 10;
  const multiLineInstruction = requireMultiLine ? MULTI_LINE_INSTRUCTION : '';

  const config = loadConfig();
  const { message } = await generateWithFallback(config, originalMessage, diff, multiLineInstruction);

  // Write the enhanced message back to the file
  fs.writeFileSync(msgFile, message, 'utf-8');
}

module.exports = {
  processCommitMessage,
  generateWithFallback,
  PROVIDERS,
  MULTI_LINE_INSTRUCTION
};
