const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Get the root directory of the current git repository
 * @returns {string|null} Path to repo root, or null if not in a git repo
 */
function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if the current directory is inside a git repository
 * @returns {boolean} True if in a git repo
 */
function isGitRepository() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the path to the .git directory
 * @returns {string} Path to .git directory
 */
function getGitDir() {
  try {
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf-8' }).trim();
    return path.resolve(gitDir);
  } catch (error) {
    throw new Error('Not a git repository. Please run this command inside a git repository.');
  }
}

/**
 * Get the path to the hooks directory
 * @returns {string} Path to .git/hooks directory
 */
function getHooksDir() {
  const gitDir = getGitDir();
  return path.join(gitDir, 'hooks');
}

/**
 * Get the staged diff (changes that will be committed)
 * @returns {string} The diff output
 */
function getStagedDiff() {
  try {
    const diff = execSync('git diff --cached --no-color', { 
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large diffs
    });
    
    if (!diff.trim()) {
      // If no staged changes, try to get the diff from HEAD
      return execSync('git diff HEAD --no-color', {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      });
    }
    
    return diff;
  } catch (error) {
    // Might be initial commit with no HEAD
    try {
      return execSync('git diff --cached --no-color', {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      });
    } catch {
      return '';
    }
  }
}

/**
 * Get the prepare-commit-msg hook path
 * @returns {string} Full path to the hook file
 */
function getHookPath() {
  return path.join(getHooksDir(), 'prepare-commit-msg');
}

/**
 * Check if our hook is already installed
 * @returns {boolean} True if nullcommits hook is installed
 */
function isHookInstalled() {
  const hookPath = getHookPath();
  
  if (!fs.existsSync(hookPath)) {
    return false;
  }
  
  const content = fs.readFileSync(hookPath, 'utf-8');
  return content.includes('nullcommit');
}

/**
 * Generate the hook script content
 * @returns {string} The shell script content for the hook
 */
function generateHookScript() {
  return `#!/bin/sh
# nullcommits - AI-powered commit message enhancer
# This hook was installed by nullcommits. Do not edit manually.

COMMIT_MSG_FILE="$1"
COMMIT_SOURCE="$2"

# Only process if this is a regular commit (not merge, squash, etc.)
if [ -z "$COMMIT_SOURCE" ] || [ "$COMMIT_SOURCE" = "message" ]; then
  nullcommits process "$COMMIT_MSG_FILE"
  exit $?
fi

exit 0
`;
}

module.exports = {
  isGitRepository,
  getRepoRoot,
  getGitDir,
  getHooksDir,
  getStagedDiff,
  getHookPath,
  isHookInstalled,
  generateHookScript
};