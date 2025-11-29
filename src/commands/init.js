const { initGlobalTemplate, GLOBAL_TEMPLATE_FILE } = require('../config');

/**
 * Initialize nullcommits - creates global template file
 */
async function init() {
  const result = initGlobalTemplate();
  
  return {
    ...result,
    templatePath: GLOBAL_TEMPLATE_FILE
  };
}

module.exports = {
  init
};