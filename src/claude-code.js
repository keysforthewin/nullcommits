const { loadConfig } = require('./config');
const { buildPrompt, cleanMessage } = require('./prompt');
const {
  runCli,
  isOnPath,
  classifyCliFailure,
  ProviderExhaustedError,
  ProviderUnavailableError
} = require('./cli-provider');

const LABEL = 'Claude Code';

/**
 * Flags that keep the headless run isolated and cheap:
 * - no tools, so the model cannot wander off and run commands
 * - no user/project/local settings, so a repo's CLAUDE.md or hooks never apply
 * - no MCP servers (they add seconds of startup)
 * - no session persistence (a hook run should leave no transcript behind)
 * Do NOT add --bare: it skips keychain reads and reports "Not logged in".
 */
function baseArgs(config, model) {
  return [
    '-p',
    '--output-format', 'json',
    '--tools', '',
    '--setting-sources', '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--model', model
  ];
}

/**
 * Parse `claude -p --output-format json` output. Newer versions emit an array
 * of events (rate_limit_event, system init, result); older ones emit a single
 * result object.
 * @param {string} stdout
 * @returns {{result: Object|null, rateLimit: Object|null}}
 */
function parseOutput(stdout) {
  const trimmed = stdout.trim();
  const start = trimmed.search(/[[{]/);
  if (start === -1) {
    throw new Error(`${LABEL} returned no JSON: ${trimmed.slice(0, 200)}`);
  }
  const parsed = JSON.parse(trimmed.slice(start));
  const events = Array.isArray(parsed) ? parsed : [parsed];
  const result = events.find(e => e && e.type === 'result') || (Array.isArray(parsed) ? null : parsed);
  const rateEvent = events.find(e => e && e.type === 'rate_limit_event');
  return { result, rateLimit: rateEvent ? rateEvent.rate_limit_info : null };
}

/**
 * Turn a parsed run into either a message or a typed error.
 * @param {{result: Object|null, rateLimit: Object|null}} parsed
 * @returns {string}
 */
function extractMessage(parsed) {
  const { result, rateLimit } = parsed;

  if (rateLimit && rateLimit.status && rateLimit.status !== 'allowed') {
    throw new ProviderExhaustedError(`${LABEL} plan status is "${rateLimit.status}"`);
  }

  if (!result) {
    throw new Error(`${LABEL} returned no result event`);
  }

  if (result.is_error) {
    const text = String(result.result || result.error || 'unknown error');
    if (/limit|quota|usage|overage/i.test(text)) {
      throw new ProviderExhaustedError(`${LABEL} plan limit reached: ${text}`);
    }
    if (/not logged in|login/i.test(text)) {
      throw new ProviderUnavailableError(`${LABEL} is not logged in: ${text}`);
    }
    throw new Error(`${LABEL} error: ${text}`);
  }

  const message = cleanMessage(result.result);
  if (!message) {
    throw new Error(`${LABEL} returned an empty message`);
  }
  return message;
}

/**
 * Whether this provider can be attempted on this machine.
 * @param {Object} config
 * @returns {boolean}
 */
function isConfigured(config) {
  return isOnPath(config.claudeCodeBin);
}

/**
 * Generate a commit message through the Claude Code CLI (subscription).
 * @param {string} originalMessage
 * @param {string} diff
 * @param {string} multiLineInstruction
 * @returns {Promise<string>}
 */
async function generateCommitMessage(originalMessage, diff, multiLineInstruction = '') {
  const config = loadConfig();
  const { system, user } = buildPrompt(originalMessage, diff, multiLineInstruction);
  const args = [...baseArgs(config, config.claudeCodeModel), '--system-prompt', system];

  const run = await runCli(config.claudeCodeBin, args, {
    stdin: user,
    timeoutMs: config.cliTimeoutMs
  });

  if (run.timedOut) {
    throw new Error(`${LABEL} timed out after ${config.cliTimeoutMs}ms`);
  }

  // Claude Code exits non-zero on API-side errors but still prints JSON, so try
  // to parse first and fall back to text classification.
  try {
    return extractMessage(parseOutput(run.stdout));
  } catch (error) {
    if (error instanceof ProviderExhaustedError || error instanceof ProviderUnavailableError) {
      throw error;
    }
    if (run.code !== 0) {
      throw classifyCliFailure(LABEL, run.stderr.trim() || run.stdout, run.code);
    }
    throw error;
  }
}

/**
 * Cheap health probe used by `nullcommits doctor`.
 * @returns {Promise<{available: boolean, loggedIn: boolean, model: string|null, utilization: Object|null, error: string|null}>}
 */
async function checkStatus() {
  const config = loadConfig();
  const status = { available: false, loggedIn: false, model: null, utilization: null, error: null };

  if (!isOnPath(config.claudeCodeBin)) {
    status.error = `${config.claudeCodeBin} not found on PATH`;
    return status;
  }
  status.available = true;

  try {
    const run = await runCli(config.claudeCodeBin, baseArgs(config, config.claudeCodeModel), {
      stdin: 'Reply with exactly: OK',
      timeoutMs: config.cliTimeoutMs
    });
    const parsed = parseOutput(run.stdout);
    if (parsed.rateLimit && parsed.rateLimit.unifiedWindows) {
      status.utilization = parsed.rateLimit.unifiedWindows;
    }
    if (parsed.result && parsed.result.modelUsage) {
      status.model = Object.keys(parsed.result.modelUsage)[0] || null;
    }
    extractMessage(parsed);
    status.loggedIn = true;
  } catch (error) {
    status.loggedIn = !(error instanceof ProviderUnavailableError);
    status.error = error.message;
  }
  return status;
}

module.exports = {
  generateCommitMessage,
  isConfigured,
  checkStatus,
  parseOutput,
  extractMessage
};
