const { spawn, spawnSync } = require('child_process');
const os = require('os');

/**
 * Thrown when a provider cannot be used at all on this machine right now
 * (binary missing, not logged in, no API key). The runner skips it quietly.
 */
class ProviderUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * Thrown when a provider is set up but its plan/quota is exhausted or rate
 * limited. The runner falls through to the next provider.
 */
class ProviderExhaustedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderExhaustedError';
  }
}

/**
 * Check whether a binary can be executed. Absolute paths are checked with
 * `--version`; bare names are resolved via the shell's PATH lookup.
 * @param {string} bin
 * @returns {boolean}
 */
function isOnPath(bin) {
  if (!bin) return false;
  const lookup = process.platform === 'win32'
    ? spawnSync('where', [bin], { stdio: 'ignore' })
    : spawnSync('sh', ['-c', `command -v "$1" >/dev/null 2>&1`, 'sh', bin], { stdio: 'ignore' });
  return lookup.status === 0;
}

/**
 * Run a CLI to completion, feeding it stdin and enforcing a timeout.
 * @param {string} bin
 * @param {string[]} args
 * @param {{stdin?: string, timeoutMs?: number, cwd?: string, env?: Object}} options
 * @returns {Promise<{code: number|null, signal: string|null, stdout: string, stderr: string, timedOut: boolean}>}
 */
function runCli(bin, args, { stdin = '', timeoutMs = 60000, cwd = os.tmpdir(), env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(bin, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      reject(new ProviderUnavailableError(`Could not start ${bin}: ${error.message}`));
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, 2000).unref();
    }, timeoutMs);

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        reject(new ProviderUnavailableError(`${bin} is not installed or not on PATH`));
      } else {
        reject(error);
      }
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut });
    });

    child.stdin.on('error', () => { /* child exited before reading stdin */ });
    child.stdin.end(stdin);
  });
}

/**
 * Classify a CLI failure from its stderr/stdout text.
 * @param {string} providerLabel
 * @param {string} text
 * @param {number|null} code
 * @returns {Error}
 */
function classifyCliFailure(providerLabel, text, code) {
  const snippet = (text || '').trim().split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 300);
  if (/usage limit|rate.?limit|quota|too many requests|\b429\b|hit your limit|limit reached/i.test(text)) {
    return new ProviderExhaustedError(`${providerLabel} plan limit reached: ${snippet}`);
  }
  if (/not logged in|please (run )?\/?login|unauthori[sz]ed|\b401\b|authentication/i.test(text)) {
    return new ProviderUnavailableError(`${providerLabel} is not logged in: ${snippet}`);
  }
  return new Error(`${providerLabel} failed (exit ${code}): ${snippet || 'no output'}`);
}

module.exports = {
  ProviderUnavailableError,
  ProviderExhaustedError,
  isOnPath,
  runCli,
  classifyCliFailure
};
