const fs = require('fs');
const path = require('path');
const { 
  isGitRepository, 
  getHooksDir, 
  getHookPath, 
  isHookInstalled,
  generateHookScript 
} = require('../git');

/**
 * Install the nullcommits hook in the current git repository
 */
async function install() {
  // Check if we're in a git repository
  if (!isGitRepository()) {
    throw new Error('Not a git repository. Please run this command inside a git repository.');
  }

  // Check if hook is already installed
  if (isHookInstalled()) {
    throw new Error('nullcommits hook is already installed in this repository.');
  }

  const hooksDir = getHooksDir();
  const hookPath = getHookPath();

  // Create hooks directory if it doesn't exist
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  // Check if there's an existing prepare-commit-msg hook
  if (fs.existsSync(hookPath)) {
    // Back up the existing hook
    const backupPath = hookPath + '.backup';
    fs.copyFileSync(hookPath, backupPath);
    console.log(`📦 Existing hook backed up to: ${path.basename(backupPath)}`);
  }

  // Write the hook script
  const hookScript = generateHookScript();
  fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });

  // Make sure it's executable (for Unix systems)
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {
    // chmod might fail on Windows, but that's okay
  }
}

module.exports = {
  install
};