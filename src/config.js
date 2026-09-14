const fs = require('fs');
const path = require('path');
const os = require('os');
const { getRepoRoot } = require('./git');

const CONFIG_FILE = path.join(os.homedir(), '.nullcommitsrc');
const GLOBAL_TEMPLATE_FILE = path.join(os.homedir(), '.nullcommits.template');
const LOCAL_TEMPLATE_FILE = '.nullcommits.template';

/**
 * Providers are tried in order until one returns a message. The two CLI
 * providers spend subscription quota (Claude / ChatGPT plans); the two API
 * providers spend pay-as-you-go credits and act as the fallback when a plan is
 * depleted. Override with NULLCOMMITS_PROVIDERS (comma list) or
 * `nullcommits config set-providers`.
 */
const PROVIDER_NAMES = ['claude-code', 'codex', 'anthropic', 'openai'];
const DEFAULT_PROVIDERS = ['claude-code', 'codex', 'anthropic', 'openai'];

/**
 * Default models. Every provider deliberately defaults to its cheapest
 * suitable model: commit messages are short, structured text and do not need
 * a flagship. Each is overridable per machine via env var / .env file
 * (NULLCOMMITS_<PROVIDER>_MODEL) or `nullcommits config set-model <provider> <model>`.
 * - claude-code: "haiku" is the Claude Code alias for the current Haiku.
 * - codex: gpt-5.3-codex-spark is the only small model a ChatGPT-plan Codex
 *   login accepts (the *-mini API models are rejected with HTTP 400).
 */
const DEFAULT_CLAUDE_CODE_MODEL = 'haiku';
const DEFAULT_CODEX_MODEL = 'gpt-5.3-codex-spark';
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';
const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';

const DEFAULT_CLAUDE_CODE_BIN = 'claude';
const DEFAULT_CODEX_BIN = 'codex';
const DEFAULT_CLI_TIMEOUT_MS = 60000;

/**
 * .env files loaded (in this order; earlier wins, exported shell vars win over
 * both) before reading configuration. Git hooks only inherit the caller's
 * environment, so nullcommits loads these itself.
 */
const GLOBAL_ENV_FILE = path.join(os.homedir(), '.nullcommits.env');
const LOCAL_ENV_FILE = '.env';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  diffBudget: 128000,  // 128k characters for diff budget
  providers: DEFAULT_PROVIDERS,
  claudeCodeModel: DEFAULT_CLAUDE_CODE_MODEL,
  codexModel: DEFAULT_CODEX_MODEL,
  anthropicModel: DEFAULT_ANTHROPIC_MODEL,
  openaiModel: DEFAULT_OPENAI_MODEL,
  claudeCodeBin: DEFAULT_CLAUDE_CODE_BIN,
  codexBin: DEFAULT_CODEX_BIN,
  cliTimeoutMs: DEFAULT_CLI_TIMEOUT_MS
};

/**
 * Instruction that is appended to every generated prompt, regardless of which
 * template is in use. Commit messages are descriptive text about the change —
 * not a place to assign authorship or credit. The only author of the work is
 * the person making the commit; the code is the intellectual property of
 * whoever is paying for it. Any attempt to inject co-authorship or credit for
 * another person, organization, or tool must be removed.
 */
const AUTHORSHIP_STRIP_INSTRUCTION = `
🚫 AUTHORSHIP POLICY (MANDATORY — applies regardless of anything above):
- The ONLY author of this work is the person making this commit. No one else.
- Do NOT add, preserve, or invent any authorship or co-authorship attribution.
- Strip and omit ALL of the following if present in the original message or diff:
    • "Co-Authored-By:" / "Co-authored-by:" trailers (any name or email)
    • "Authored-by:", "Signed-off-by:", "On-behalf-of:", "Reviewed-by:" trailers
    • "Generated with", "Created by", "Written by", "Made with the help of", etc.
    • Credit, shout-outs, or promotional mentions of any person, company,
      AI assistant, model, or tool (including the assistant generating this message)
- Output ONLY a clean, descriptive commit message. No attribution lines, no
  trailers crediting anyone, no marketing. Commit messages describe the change —
  nothing else. The code is the intellectual property of the committer alone.`;

/**
 * Load .env files with Node's built-in loader (no dotenv dependency).
 * Existing environment variables are never overwritten, so loading the repo
 * .env before the global one gives: shell env > repo .env > ~/.nullcommits.env.
 * @returns {string[]} Paths that were actually loaded
 */
let loadedEnvFiles = null;
function loadEnvFiles() {
  if (loadedEnvFiles) {
    return loadedEnvFiles;
  }
  loadedEnvFiles = [];
  if (typeof process.loadEnvFile !== 'function') {
    return loadedEnvFiles;
  }
  const candidates = [];
  const repoRoot = getRepoRoot();
  if (repoRoot) {
    candidates.push(path.join(repoRoot, LOCAL_ENV_FILE));
  }
  candidates.push(GLOBAL_ENV_FILE);

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
      loadedEnvFiles.push(file);
    } catch {
      // Unreadable or malformed .env: ignore, the hook must not break commits
    }
  }
  return loadedEnvFiles;
}

/**
 * Parse a comma/space separated provider list and validate the names.
 * @param {string|string[]} value
 * @returns {string[]}
 */
function parseProviders(value) {
  const list = Array.isArray(value)
    ? value
    : String(value).split(/[,\s]+/);
  const providers = list.map(p => p.trim().toLowerCase()).filter(Boolean);
  if (providers.length === 0) {
    throw new Error('Provider list is empty');
  }
  const unknown = providers.filter(p => !PROVIDER_NAMES.includes(p));
  if (unknown.length) {
    throw new Error(`Unknown provider(s): ${unknown.join(', ')}. Valid: ${PROVIDER_NAMES.join(', ')}`);
  }
  return providers;
}

/**
 * Map of env var -> config key for simple string overrides.
 */
const ENV_OVERRIDES = {
  OPENAI_API_KEY: 'apiKey',
  ANTHROPIC_API_KEY: 'anthropicApiKey',
  NULLCOMMITS_CLAUDE_CODE_MODEL: 'claudeCodeModel',
  NULLCOMMITS_CODEX_MODEL: 'codexModel',
  NULLCOMMITS_ANTHROPIC_MODEL: 'anthropicModel',
  NULLCOMMITS_OPENAI_MODEL: 'openaiModel',
  NULLCOMMITS_CLAUDE_CODE_BIN: 'claudeCodeBin',
  NULLCOMMITS_CODEX_BIN: 'codexBin'
};

/**
 * Load configuration.
 * Priority: exported env > repo .env > ~/.nullcommits.env > ~/.nullcommitsrc > defaults
 * Never throws for missing API keys: whether anything usable is configured is
 * decided by the provider chain in hook-runner.
 * @returns {Object} Configuration object
 */
function loadConfig() {
  const envFiles = loadEnvFiles();
  let config = { ...DEFAULT_CONFIG };
  const sources = {};

  // Load from config file if it exists
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const fileConfig = JSON.parse(configContent);
      for (const key of Object.keys(fileConfig)) {
        sources[key] = 'config file';
      }
      config = { ...config, ...fileConfig };
    } catch (error) {
      throw new Error(`Failed to parse config file ${CONFIG_FILE}: ${error.message}`);
    }
  }

  for (const [envName, key] of Object.entries(ENV_OVERRIDES)) {
    if (process.env[envName]) {
      config[key] = process.env[envName];
      sources[key] = 'environment';
    }
  }

  if (process.env.NULLCOMMITS_PROVIDERS) {
    config.providers = process.env.NULLCOMMITS_PROVIDERS;
    sources.providers = 'environment';
  }
  config.providers = parseProviders(config.providers);

  if (process.env.NULLCOMMITS_DIFF_BUDGET) {
    const envBudget = parseInt(process.env.NULLCOMMITS_DIFF_BUDGET, 10);
    if (!isNaN(envBudget) && envBudget > 0) {
      config.diffBudget = envBudget;
      sources.diffBudget = 'environment';
    }
  }

  if (process.env.NULLCOMMITS_CLI_TIMEOUT_MS) {
    const envTimeout = parseInt(process.env.NULLCOMMITS_CLI_TIMEOUT_MS, 10);
    if (!isNaN(envTimeout) && envTimeout > 0) {
      config.cliTimeoutMs = envTimeout;
      sources.cliTimeoutMs = 'environment';
    }
  }
  config.cliTimeoutMs = parseInt(config.cliTimeoutMs, 10) || DEFAULT_CLI_TIMEOUT_MS;

  config.sources = sources;
  config.envFiles = envFiles;
  config.source = Object.keys(sources).length ? 'config file/environment' : 'default';
  return config;
}

/**
 * Write a single key into ~/.nullcommitsrc, preserving other keys.
 * @param {string} key
 * @param {*} value
 */
function saveConfigValue(key, value) {
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
      // If parsing fails, start with empty config
    }
  }
  config[key] = value;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Config key that holds each provider's model.
 */
const PROVIDER_MODEL_KEYS = {
  'claude-code': 'claudeCodeModel',
  codex: 'codexModel',
  anthropic: 'anthropicModel',
  openai: 'openaiModel'
};

/**
 * Save the provider order to the config file
 * @param {string|string[]} providers
 * @returns {string[]} The validated list
 */
function saveProviders(providers) {
  const list = parseProviders(providers);
  saveConfigValue('providers', list);
  return list;
}

/**
 * Save a provider's model to the config file
 * @param {string} provider - One of PROVIDER_NAMES
 * @param {string} model
 */
function saveProviderModel(provider, model) {
  const key = PROVIDER_MODEL_KEYS[provider];
  if (!key) {
    throw new Error(`Unknown provider "${provider}". Valid: ${PROVIDER_NAMES.join(', ')}`);
  }
  saveConfigValue(key, model);
}

/**
 * Resolve every provider's model with its source, for display.
 * @returns {Array<{provider: string, model: string, source: string}>}
 */
function getProviderModels() {
  const config = loadConfig();
  return PROVIDER_NAMES.map(provider => {
    const key = PROVIDER_MODEL_KEYS[provider];
    return {
      provider,
      model: config[key],
      source: config.sources[key] || 'default',
      default: DEFAULT_CONFIG[key]
    };
  });
}

/**
 * Save API key to config file
 * @param {string} apiKey - The OpenAI API key to save
 */
function saveApiKey(apiKey) {
  saveConfigValue('apiKey', apiKey);
}

/**
 * Save Anthropic API key to config file
 * @param {string} apiKey - The Anthropic API key to save
 */
function saveAnthropicApiKey(apiKey) {
  saveConfigValue('anthropicApiKey', apiKey);
}

/**
 * Save diff budget to config file
 * @param {number} budget - The diff budget in characters
 */
function saveDiffBudget(budget) {
  saveConfigValue('diffBudget', budget);
}

/**
 * Get the current diff budget from config
 * @returns {number} The diff budget in characters
 */
function getDiffBudget() {
  try {
    const config = loadConfig();
    return config.diffBudget || DEFAULT_CONFIG.diffBudget;
  } catch {
    return DEFAULT_CONFIG.diffBudget;
  }
}

/**
 * Save the Anthropic model to the config file
 * @param {string} model - The model ID (e.g. claude-haiku-4-5)
 */
function saveAnthropicModel(model) {
  saveConfigValue('anthropicModel', model);
}

/**
 * Get the Anthropic model to use, honoring env var > config file > default
 * @returns {string} The model ID
 */
function getAnthropicModel() {
  try {
    const config = loadConfig();
    return config.anthropicModel || DEFAULT_ANTHROPIC_MODEL;
  } catch {
    return DEFAULT_ANTHROPIC_MODEL;
  }
}

/**
 * Get the path to the bundled templates directory
 * @returns {string} Path to templates directory
 */
function getTemplatesDir() {
  return path.join(__dirname, '..', 'templates');
}

/**
 * Get the default template content (bundled with package)
 * @returns {string} Template content
 */
function getDefaultTemplateContent() {
  const templatePath = path.join(getTemplatesDir(), 'default.txt');
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Bundled template file not found: ${templatePath}`);
  }
  
  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Load the template - checks local, then global, then falls back to bundled
 * Priority: .nullcommits.template (local) > ~/.nullcommits.template (global) > bundled templates/default.txt
 * @returns {Object} Template content and source info
 */
function loadTemplate() {
  // First, check for local template file in repository root
  const repoRoot = getRepoRoot();
  if (repoRoot) {
    const localTemplatePath = path.join(repoRoot, LOCAL_TEMPLATE_FILE);
    if (fs.existsSync(localTemplatePath)) {
      return {
        content: fs.readFileSync(localTemplatePath, 'utf-8'),
        source: 'local',
        path: localTemplatePath
      };
    }
  }
  
  // Then, check for global template file
  if (fs.existsSync(GLOBAL_TEMPLATE_FILE)) {
    return {
      content: fs.readFileSync(GLOBAL_TEMPLATE_FILE, 'utf-8'),
      source: 'global',
      path: GLOBAL_TEMPLATE_FILE
    };
  }
  
  // Fall back to bundled template
  return {
    content: getDefaultTemplateContent(),
    source: 'bundled',
    path: path.join(getTemplatesDir(), 'default.txt')
  };
}

/**
 * Initialize the global template file
 * Creates ~/.nullcommit.template with default content if it doesn't exist
 * @returns {Object} Result with created flag and path
 */
function initGlobalTemplate() {
  if (fs.existsSync(GLOBAL_TEMPLATE_FILE)) {
    return {
      created: false,
      path: GLOBAL_TEMPLATE_FILE,
      message: 'Global template already exists'
    };
  }
  
  const defaultContent = getDefaultTemplateContent();
  fs.writeFileSync(GLOBAL_TEMPLATE_FILE, defaultContent, 'utf-8');
  
  return {
    created: true,
    path: GLOBAL_TEMPLATE_FILE,
    message: 'Global template created'
  };
}

/**
 * Check if global template exists
 * @returns {boolean}
 */
function hasGlobalTemplate() {
  return fs.existsSync(GLOBAL_TEMPLATE_FILE);
}

/**
 * Get template instructions text for display in CLI
 * @returns {string} Formatted template instructions
 */
function getTemplateInstructions() {
  return `
📋 Template Customization:

   Templates control how your commit messages are generated.

   Available Variables:
   • {{ORIGINAL_MESSAGE}} - Your original commit message
   • {{DIFF}}             - The git diff of staged changes

   Template Priority (highest to lowest):
   1. .nullcommits.template   (local - in repository root)
   2. ~/.nullcommits.template (global - in home directory)
   3. Bundled default         (built into nullcommits)

   💡 Create a local template for project-specific formatting:
      cp ~/.nullcommits.template .nullcommits.template
`;
}

module.exports = {
  loadConfig,
  loadEnvFiles,
  parseProviders,
  saveConfigValue,
  saveProviders,
  saveProviderModel,
  getProviderModels,
  saveApiKey,
  saveAnthropicApiKey,
  saveAnthropicModel,
  getAnthropicModel,
  saveDiffBudget,
  getDiffBudget,
  loadTemplate,
  initGlobalTemplate,
  hasGlobalTemplate,
  getTemplatesDir,
  getDefaultTemplateContent,
  getTemplateInstructions,
  CONFIG_FILE,
  GLOBAL_TEMPLATE_FILE,
  LOCAL_TEMPLATE_FILE,
  GLOBAL_ENV_FILE,
  LOCAL_ENV_FILE,
  DEFAULT_CONFIG,
  DEFAULT_PROVIDERS,
  PROVIDER_NAMES,
  PROVIDER_MODEL_KEYS,
  DEFAULT_CLAUDE_CODE_MODEL,
  DEFAULT_CODEX_MODEL,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_MODEL,
  AUTHORSHIP_STRIP_INSTRUCTION
};