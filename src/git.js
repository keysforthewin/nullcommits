const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Media file extensions that should only show filename (no diff content)
 */
const MEDIA_EXTENSIONS = new Set([
  // Images
  '.png', '.gif', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.bmp', '.tiff', '.tif', '.avif',
  // Video
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.m4v',
  // Audio
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma'
]);

/**
 * Default budget for diff collection (in characters)
 */
const DEFAULT_DIFF_BUDGET = 128000;

/**
 * Check if a file is a media file based on extension
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if file is a media file
 */
function isMediaFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}

/**
 * Get list of staged files
 * @returns {string[]} Array of staged file paths
 */
function getStagedFileList() {
  try {
    const output = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
    return output.trim().split('\n').filter(f => f.length > 0);
  } catch (error) {
    // Try without --cached for initial commit
    try {
      const output = execSync('git diff HEAD --name-only', {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      });
      return output.trim().split('\n').filter(f => f.length > 0);
    } catch {
      return [];
    }
  }
}

/**
 * Get diff for a single file
 * @param {string} filePath - Path to the file
 * @returns {string} Diff content for the file
 */
function getFileDiff(filePath) {
  try {
    return execSync(`git diff --cached --no-color -- "${filePath}"`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    try {
      return execSync(`git diff HEAD --no-color -- "${filePath}"`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      });
    } catch {
      return '';
    }
  }
}

/**
 * Count added and removed lines in a diff string
 * @param {string} diff - Diff content
 * @returns {{added: number, removed: number}} Count of added and removed lines
 */
function countDiffLines(diff) {
  const lines = diff.split('\n');
  let added = 0;
  let removed = 0;
  
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      added++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removed++;
    }
  }
  
  return { added, removed };
}

/**
 * Get staged diff with intelligent budget allocation
 * @param {number} budget - Total character budget for diff (default: 128000)
 * @returns {{diff: string, totalLinesChanged: number, fileCount: number}} Smart diff result
 */
function getSmartStagedDiff(budget = DEFAULT_DIFF_BUDGET) {
  const files = getStagedFileList();
  
  if (files.length === 0) {
    return { diff: '', totalLinesChanged: 0, fileCount: 0 };
  }
  
  // Separate media files from code files
  const mediaFiles = [];
  const codeFiles = [];
  
  for (const file of files) {
    if (isMediaFile(file)) {
      mediaFiles.push(file);
    } else {
      codeFiles.push(file);
    }
  }
  
  // Collect diffs for code files
  const fileDiffs = [];
  let totalLinesChanged = 0;
  
  for (const file of codeFiles) {
    const diff = getFileDiff(file);
    const { added, removed } = countDiffLines(diff);
    totalLinesChanged += added + removed;
    fileDiffs.push({
      file,
      diff,
      length: diff.length,
      truncated: false
    });
  }
  
  // Calculate initial budget per code file
  const codeFileCount = codeFiles.length;
  if (codeFileCount === 0) {
    // Only media files, just list them
    const mediaList = mediaFiles.map(f => `[Media file] ${f}`).join('\n');
    return { diff: mediaList, totalLinesChanged: 0, fileCount: files.length };
  }
  
  const budgetPerFile = Math.floor(budget / codeFileCount);
  
  // First pass: allocate up to budget per file, track unused budget
  let unusedBudget = 0;
  const truncatedFiles = [];
  
  for (const fd of fileDiffs) {
    if (fd.length <= budgetPerFile) {
      // File fits within budget, track unused portion
      unusedBudget += budgetPerFile - fd.length;
    } else {
      // File exceeds budget, will need truncation
      fd.truncated = true;
      truncatedFiles.push(fd);
    }
  }
  
  // Second pass: redistribute unused budget to truncated files
  if (unusedBudget > 0 && truncatedFiles.length > 0) {
    const extraPerFile = Math.floor(unusedBudget / truncatedFiles.length);
    for (const fd of truncatedFiles) {
      fd.allocatedBudget = budgetPerFile + extraPerFile;
    }
  } else {
    for (const fd of truncatedFiles) {
      fd.allocatedBudget = budgetPerFile;
    }
  }
  
  // Build final diff output
  const diffParts = [];
  
  // Add media files first (just filenames)
  if (mediaFiles.length > 0) {
    diffParts.push('--- Media files (binary, showing names only) ---');
    for (const file of mediaFiles) {
      diffParts.push(`[Media] ${file}`);
    }
    diffParts.push('');
  }
  
  // Add code file diffs
  for (const fd of fileDiffs) {
    if (fd.truncated && fd.allocatedBudget) {
      // Truncate to allocated budget
      const truncatedDiff = fd.diff.substring(0, fd.allocatedBudget);
      diffParts.push(truncatedDiff);
      diffParts.push(`\n... [${fd.file} diff truncated, ${fd.length - fd.allocatedBudget} chars omitted]`);
    } else if (fd.length > budgetPerFile) {
      // Truncate to base budget
      const truncatedDiff = fd.diff.substring(0, budgetPerFile);
      diffParts.push(truncatedDiff);
      diffParts.push(`\n... [${fd.file} diff truncated, ${fd.length - budgetPerFile} chars omitted]`);
    } else {
      diffParts.push(fd.diff);
    }
  }
  
  return {
    diff: diffParts.join('\n'),
    totalLinesChanged,
    fileCount: files.length
  };
}

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
  getSmartStagedDiff,
  getStagedFileList,
  getFileDiff,
  isMediaFile,
  countDiffLines,
  getHookPath,
  isHookInstalled,
  generateHookScript,
  MEDIA_EXTENSIONS,
  DEFAULT_DIFF_BUDGET
};