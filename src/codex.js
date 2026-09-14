const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('./config');
const { buildPrompt, cleanMessage } = require('./prompt');
const { runCli, isOnPath, classifyCliFailure } = require('./cli-provider');

const LABEL = 'Codex';

/**
 * Flags that keep the headless run isolated and cheap:
 * - read-only sandbox so the model cannot touch files
 * - skip the git repo check (we run in the temp dir on purpose)
 * - ephemeral so no session/rollout is written
 * - -o writes only the final assistant message to a file, which avoids parsing
 *   the human-readable transcript on stdout
 * - "-" reads the prompt from stdin
 */
function baseArgs(model, outFile) {
  return [
    'exec',
    '--skip-git-repo-check',
    '-s', 'read-only',
    '--ephemeral',
    '-m', model,
    '-o', outFile,
    '-'
  ];
}

/**
 * Whether this provider can be attempted on this machine.
 * @param {Object} config
 * @returns {boolean}
 */
function isConfigured(config) {
  return isOnPath(config.codexBin);
}

/**
 * Run codex with a prompt and return the last assistant message.
 * @param {Object} config
 * @param {string} prompt
 * @returns {Promise<{message: string, run: Object}>}
 */
async function runCodex(config, prompt) {
  const outFile = path.join(os.tmpdir(), `nullcommits-codex-${process.pid}-${Date.now()}.txt`);
  try {
    const run = await runCli(config.codexBin, baseArgs(config.codexModel, outFile), {
      stdin: prompt,
      timeoutMs: config.cliTimeoutMs
    });

    if (run.timedOut) {
      throw new Error(`${LABEL} timed out after ${config.cliTimeoutMs}ms`);
    }

    const combined = run.stderr + '\n' + run.stdout;
    // Codex prints API errors as ERROR lines and may still exit 0 for some of
    // them, so check the text before trusting the exit code.
    if (run.code !== 0 || /^ERROR:/m.test(combined)) {
      throw classifyCliFailure(LABEL, combined, run.code);
    }

    const message = fs.existsSync(outFile) ? cleanMessage(fs.readFileSync(outFile, 'utf-8')) : '';
    if (!message) {
      throw new Error(`${LABEL} returned an empty message`);
    }
    return { message, run };
  } finally {
    try { fs.unlinkSync(outFile); } catch { /* already gone */ }
  }
}

/**
 * Generate a commit message through the Codex CLI (ChatGPT subscription).
 * @param {string} originalMessage
 * @param {string} diff
 * @param {string} multiLineInstruction
 * @returns {Promise<string>}
 */
async function generateCommitMessage(originalMessage, diff, multiLineInstruction = '') {
  const config = loadConfig();
  const { system, user } = buildPrompt(originalMessage, diff, multiLineInstruction);
  const { message } = await runCodex(config, system + '\n\n' + user);
  return message;
}

/**
 * Cheap health probe used by `nullcommits doctor`.
 * @returns {Promise<{available: boolean, loggedIn: boolean, model: string|null, error: string|null}>}
 */
async function checkStatus() {
  const config = loadConfig();
  const status = { available: false, loggedIn: false, model: config.codexModel, error: null };

  if (!isOnPath(config.codexBin)) {
    status.error = `${config.codexBin} not found on PATH`;
    return status;
  }
  status.available = true;

  try {
    await runCodex(config, 'Reply with exactly: OK');
    status.loggedIn = true;
  } catch (error) {
    status.loggedIn = error.name !== 'ProviderUnavailableError';
    status.error = error.message;
  }
  return status;
}

module.exports = {
  generateCommitMessage,
  isConfigured,
  checkStatus
};
