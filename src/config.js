const fs = require('fs');
const path = require('path');
const os = require('os');
const { getRepoRoot } = require('./git');

const CONFIG_FILE = path.join(os.homedir(), '.nullcommitsrc');
const GLOBAL_TEMPLATE_FILE = path.join(os.homedir(), '.nullcommits.template');
const LOCAL_TEMPLATE_FILE = '.nullcommits.template';

/**
 * Load configuration from environment variable or config file
 * Priority: OPENAI_API_KEY env var > ~/.nullcommitrc
 * @returns {Object} Configuration object with apiKey
 */
function loadConfig() {
  // First, check environment variable
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      source: 'environment'
    };
  }

  // Then, check config file
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configContent);
      
      if (config.apiKey) {
        return {
          apiKey: config.apiKey,
          source: 'config file'
        };
      }
    } catch (error) {
      throw new Error(`Failed to parse config file ${CONFIG_FILE}: ${error.message}`);
    }
  }

  throw new Error(
    'OpenAI API key not found!\n' +
    'Please set it using one of these methods:\n' +
    '  1. Run: nullcommits config set-key YOUR_API_KEY\n' +
    '  2. Set OPENAI_API_KEY environment variable\n' +
    `  3. Create ${CONFIG_FILE} with: {"apiKey": "sk-..."}`
  );
}

/**
 * Save API key to config file
 * @param {string} apiKey - The OpenAI API key to save
 */
function saveApiKey(apiKey) {
  let config = {};
  
  // Read existing config if it exists
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
      config = JSON.parse(configContent);
    } catch {
      // If parsing fails, start with empty config
    }
  }
  
  config.apiKey = apiKey;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
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
  saveApiKey,
  loadTemplate,
  initGlobalTemplate,
  hasGlobalTemplate,
  getTemplatesDir,
  getDefaultTemplateContent,
  getTemplateInstructions,
  CONFIG_FILE,
  GLOBAL_TEMPLATE_FILE,
  LOCAL_TEMPLATE_FILE
};