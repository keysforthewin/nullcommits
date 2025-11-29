const fs = require('fs');
const { 
  isGitRepository, 
  getHookPath, 
  isHookInstalled 
} = require('../git');

/**
 * Remove the nullcommits hook from the current git repository
 */
async function uninstall() {
  // Check if we're in a git repository
  if (!isGitRepository()) {
    throw new Error('Not a git repository. Please run this command inside a git repository.');
  }

  // Check if hook is installed
  if (!isHookInstalled()) {
    throw new Error('nullcommits hook is not installed in this repository.');
  }

  const hookPath = getHookPath();
  const backupPath = hookPath + '.backup';

  // Remove the hook
  fs.unlinkSync(hookPath);

  // Restore backup if it exists
  if (fs.existsSync(backupPath)) {
    fs.renameSync(backupPath, hookPath);
    console.log('📦 Previous hook restored from backup.');
  }
}

module.exports = {
  uninstall
};