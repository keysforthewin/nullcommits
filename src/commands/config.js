const { saveApiKey, CONFIG_FILE } = require('../config');

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

module.exports = {
  setKey
};