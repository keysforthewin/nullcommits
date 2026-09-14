const { loadConfig, CONFIG_FILE } = require('../config');
const { PROVIDERS } = require('../hook-runner');

/**
 * Report which providers are usable right now, which model each will use,
 * and (for Claude Code) current plan utilization.
 * @returns {Promise<{config: Object, providers: Array<Object>}>}
 */
async function doctor() {
  const config = loadConfig();
  const results = [];

  for (const name of config.providers) {
    const provider = PROVIDERS[name];
    const entry = { name, configured: provider.isConfigured(config) };

    if (name === 'claude-code') {
      entry.model = config.claudeCodeModel;
      entry.modelSource = config.sources.claudeCodeModel || 'default';
    } else if (name === 'codex') {
      entry.model = config.codexModel;
      entry.modelSource = config.sources.codexModel || 'default';
    } else if (name === 'anthropic') {
      entry.model = config.anthropicModel;
      entry.modelSource = config.sources.anthropicModel || 'default';
    } else {
      entry.model = config.openaiModel;
      entry.modelSource = config.sources.openaiModel || 'default';
    }

    if (entry.configured && typeof provider.checkStatus === 'function') {
      entry.status = await provider.checkStatus();
    }

    results.push(entry);
  }

  return {
    configFile: CONFIG_FILE,
    envFiles: config.envFiles,
    providers: results
  };
}

module.exports = { doctor };
