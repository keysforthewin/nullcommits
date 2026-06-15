const { saveApiKey, saveAnthropicApiKey, saveAnthropicModel, getAnthropicModel, saveDiffBudget, getDiffBudget, CONFIG_FILE, DEFAULT_CONFIG, DEFAULT_ANTHROPIC_MODEL } = require('../config');

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
 * Set the Anthropic model in the config file
 * @param {string} model - The model ID (e.g. claude-sonnet-4-6)
 */
async function setModel(model) {
  if (!model) {
    throw new Error('Model is required. Usage: nullcommits config set-model claude-sonnet-4-6');
  }

  if (!model.startsWith('claude-')) {
    console.log('⚠️  Warning: model does not start with "claude-". Make sure this is a valid Anthropic model ID.');
  }

  saveAnthropicModel(model);

  return {
    success: true,
    model,
    path: CONFIG_FILE
  };
}

/**
 * Show the current Anthropic model
 */
async function showModel() {
  const model = getAnthropicModel();
  return {
    model,
    default: DEFAULT_ANTHROPIC_MODEL,
    isDefault: model === DEFAULT_ANTHROPIC_MODEL
  };
}

module.exports = {
  setKey,
  setAnthropicKey,
  setModel,
  showModel,
  setDiffBudget,
  showDiffBudget
};