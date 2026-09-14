const {
  saveApiKey,
  saveAnthropicApiKey,
  saveProviderModel,
  getProviderModels,
  saveProviders,
  saveDiffBudget,
  getDiffBudget,
  loadConfig,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  DEFAULT_PROVIDERS,
  PROVIDER_NAMES
} = require('../config');

/**
 * Set the OpenAI API key in the config file
 * @param {string} apiKey - The API key to save
 */
async function setKey(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required. Usage: nullcommits config set-key YOUR_API_KEY');
  }
  
  // Basic validation - OpenAI keys typically start with "sk-"
  if (!apiKey.startsWith('sk-')) {
    console.log('⚠️  Warning: API key does not start with "sk-". Make sure this is a valid OpenAI API key.');
  }
  
  saveApiKey(apiKey);
  
  return {
    success: true,
    path: CONFIG_FILE
  };
}

/**
 * Set the diff budget (max characters for diff) in the config file
 * @param {string|number} budget - The budget value in characters (can use K suffix like "128K")
 */
async function setDiffBudget(budget) {
  if (!budget) {
    throw new Error('Budget is required. Usage: nullcommits config set-diff-budget 128000 (or 128K)');
  }
  
  // Parse budget - support K suffix (e.g., "128K" = 128000)
  let parsedBudget;
  if (typeof budget === 'string') {
    const match = budget.toUpperCase().match(/^(\d+)(K)?$/);
    if (match) {
      parsedBudget = parseInt(match[1], 10);
      if (match[2] === 'K') {
        parsedBudget *= 1000;
      }
    }
  } else {
    parsedBudget = parseInt(budget, 10);
  }
  
  if (isNaN(parsedBudget) || parsedBudget <= 0) {
    throw new Error('Invalid budget value. Must be a positive number (e.g., 128000 or 128K)');
  }
  
  // Warn if budget is very small or very large
  if (parsedBudget < 1000) {
    console.log('⚠️  Warning: Very small budget may result in highly truncated diffs.');
  }
  if (parsedBudget > 500000) {
    console.log('⚠️  Warning: Very large budget may exceed API token limits.');
  }
  
  saveDiffBudget(parsedBudget);
  
  return {
    success: true,
    budget: parsedBudget,
    path: CONFIG_FILE
  };
}

/**
 * Show the current diff budget
 */
async function showDiffBudget() {
  const budget = getDiffBudget();
  return {
    budget,
    default: DEFAULT_CONFIG.diffBudget,
    isDefault: budget === DEFAULT_CONFIG.diffBudget
  };
}

/**
 * Set the Anthropic API key in the config file
 * @param {string} apiKey - The API key to save
 */
async function setAnthropicKey(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required. Usage: nullcommits config set-anthropic-key YOUR_API_KEY');
  }

  // Basic validation - Anthropic keys typically start with "sk-ant-"
  if (!apiKey.startsWith('sk-ant-')) {
    console.log('⚠️  Warning: API key does not start with "sk-ant-". Make sure this is a valid Anthropic API key.');
  }

  saveAnthropicApiKey(apiKey);

  return {
    success: true,
    path: CONFIG_FILE
  };
}

/**
 * Set a provider's model in the config file.
 * `set-model <model>` with no provider keeps the old meaning (anthropic).
 * @param {string} providerOrModel
 * @param {string} [maybeModel]
 */
async function setModel(providerOrModel, maybeModel) {
  let provider = 'anthropic';
  let model = providerOrModel;
  if (maybeModel) {
    provider = String(providerOrModel).toLowerCase();
    model = maybeModel;
  }

  if (!model) {
    throw new Error('Model is required. Usage: nullcommits config set-model <provider> <model>');
  }
  if (!PROVIDER_NAMES.includes(provider)) {
    throw new Error(`Unknown provider "${provider}". Valid: ${PROVIDER_NAMES.join(', ')}`);
  }

  if (provider === 'anthropic' && !model.startsWith('claude-')) {
    console.log('⚠️  Warning: model does not start with "claude-". Make sure this is a valid Anthropic model ID.');
  }

  saveProviderModel(provider, model);

  return {
    success: true,
    provider,
    model,
    path: CONFIG_FILE
  };
}

/**
 * Show every provider's model with where it came from
 */
async function showModel() {
  return { models: getProviderModels() };
}

/**
 * Set the provider fallback order
 * @param {string} list - Comma separated provider names
 */
async function setProviders(list) {
  if (!list) {
    throw new Error(`Provider list is required. Usage: nullcommits config set-providers ${DEFAULT_PROVIDERS.join(',')}`);
  }
  const providers = saveProviders(list);
  return { success: true, providers, path: CONFIG_FILE };
}

/**
 * Show the provider fallback order
 */
async function showProviders() {
  const config = loadConfig();
  return {
    providers: config.providers,
    source: config.sources.providers || 'default',
    default: DEFAULT_PROVIDERS
  };
}

module.exports = {
  setKey,
  setAnthropicKey,
  setModel,
  showModel,
  setProviders,
  showProviders,
  setDiffBudget,
  showDiffBudget
};