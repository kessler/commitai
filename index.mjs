import { getConfig } from './lib/config.mjs';
import { createLLMProvider } from './lib/llm/index.mjs';
import { execSync } from 'child_process';

export async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function parseGitStatus(statusOutput) {
  const files = new Map();
  const lines = statusOutput.trim().split('\n').filter(line => line.length > 0);

  for (const line of lines) {
    if (line.length < 3) continue;

    const indexStatus = line[0];
    const workingStatus = line[1];
    const filepath = line.substring(3);

    let status = 'unknown';

    // Determine file status based on porcelain format
    if (indexStatus === 'D' || workingStatus === 'D') {
      status = 'deleted';
    } else if (indexStatus === 'A' || workingStatus === 'A') {
      status = 'added';
    } else if (indexStatus === 'M' || workingStatus === 'M') {
      status = 'modified';
    } else if (indexStatus === 'R' || workingStatus === 'R') {
      status = 'renamed';
    } else if (indexStatus === '?' && workingStatus === '?') {
      status = 'untracked';
    }

    files.set(filepath, {
      indexStatus,
      workingStatus,
      status,
      filepath
    });
  }

  return files;
}

export function getGitDiff(options = {}) {
  const config = { ...getConfig(), ...options };
  const gitPath = config.git || 'git';

  try {
    const gitStatus = execSync(`${gitPath} status --porcelain`, { encoding: 'utf8' });
    const gitDiff = execSync(`${gitPath} diff --staged`, { encoding: 'utf8' });
    const gitDiffNameStatus = execSync(`${gitPath} diff --staged --name-status`, { encoding: 'utf8' });

    // Parse the status to get file operations
    const fileStatuses = parseGitStatus(gitStatus);

    // Create a summary of file operations
    const deletedFiles = [];
    const modifiedFiles = [];
    const addedFiles = [];

    for (const [filepath, fileInfo] of fileStatuses) {
      if (fileInfo.status === 'deleted' && fileInfo.indexStatus === 'D') {
        deletedFiles.push(filepath);
      } else if (fileInfo.status === 'added' && fileInfo.indexStatus === 'A') {
        addedFiles.push(filepath);
      } else if (fileInfo.status === 'modified' && fileInfo.indexStatus === 'M') {
        modifiedFiles.push(filepath);
      }
    }

    // Build file status summary
    let fileStatusSummary = '';
    if (deletedFiles.length > 0) {
      fileStatusSummary += `Deleted files:\n${deletedFiles.map(f => '  - ' + f).join('\n')}\n\n`;
    }
    if (addedFiles.length > 0) {
      fileStatusSummary += `Added files:\n${addedFiles.map(f => '  - ' + f).join('\n')}\n\n`;
    }
    if (modifiedFiles.length > 0) {
      fileStatusSummary += `Modified files:\n${modifiedFiles.map(f => '  - ' + f).join('\n')}\n\n`;
    }

    if (!gitDiff || gitDiff.trim().length === 0) {
      const unstagedDiff = execSync(`${gitPath} diff`, { encoding: 'utf8' });
      const unstagedNameStatus = execSync(`${gitPath} diff --name-status`, { encoding: 'utf8' });

      // Check for deleted files in unstaged changes
      const unstagedDeleted = [];
      const unstagedModified = [];
      const unstagedAdded = [];

      for (const [filepath, fileInfo] of fileStatuses) {
        if (fileInfo.status === 'deleted' && fileInfo.workingStatus === 'D') {
          unstagedDeleted.push(filepath);
        } else if (fileInfo.status === 'modified' && fileInfo.workingStatus === 'M') {
          unstagedModified.push(filepath);
        }
      }

      if (!unstagedDiff || (unstagedDiff.trim().length === 0 && unstagedDeleted.length === 0)) {
        throw new Error('No changes detected. Please stage your changes with "git add" or make some changes first.');
      }

      console.error('No staged changes found. Using unstaged changes instead.');
      console.error('Tip: Use "git add" to stage your changes before generating commit messages.\n');

      // Build unstaged file status summary
      let unstagedFileStatusSummary = '';
      if (unstagedDeleted.length > 0) {
        unstagedFileStatusSummary += `Deleted files (unstaged):\n${unstagedDeleted.map(f => '  - ' + f).join('\n')}\n\n`;
      }
      if (unstagedModified.length > 0) {
        unstagedFileStatusSummary += `Modified files (unstaged):\n${unstagedModified.map(f => '  - ' + f).join('\n')}\n\n`;
      }

      return `Git Status:\n${gitStatus}\n\n${unstagedFileStatusSummary}Git Diff Name Status (Unstaged):\n${unstagedNameStatus}\n\nGit Diff (Unstaged):\n${unstagedDiff}`;
    } else {
      // Check if only deleted files are staged (no diff content)
      if (gitDiff.trim().length === 0 && deletedFiles.length > 0) {
        return `Git Status:\n${gitStatus}\n\n${fileStatusSummary}Git Diff Name Status (Staged):\n${gitDiffNameStatus}\n\nNote: Only file deletions are staged (no content diff available)`;
      }

      return `Git Status:\n${gitStatus}\n\n${fileStatusSummary}Git Diff Name Status (Staged):\n${gitDiffNameStatus}\n\nGit Diff (Staged):\n${gitDiff}`;
    }
  } catch (error) {
    if (error.message.includes('No changes detected')) {
      throw error;
    }
    throw new Error(`Error running git commands: ${error.message}. Make sure you are in a git repository.`);
  }
}

export async function generate(diff, options = {}) {
  const config = { ...getConfig(), ...options };

  if (!diff) {
    throw new Error('Diff content is required');
  }

  if (typeof diff !== 'string') {
    throw new Error('Diff must be a string');
  }

  if (diff.trim().length === 0) {
    throw new Error('No diff content provided');
  }

  const provider = createLLMProvider(config);
  const result = await provider.generateCommitMessages(diff);
  //console.error(JSON.stringify(result, null, '\t'))
  
  // Reorganize commits to merge overlapping file groups
  if (result.commits && Array.isArray(result.commits)) {
    const fileToCommitsMap = new Map(); // Track which commits each file belongs to

    // First pass: map each file to all commits that include it
    result.commits.forEach((commit, index) => {
      if (commit.files && commit.message) {
        commit.files.forEach(file => {
          if (!fileToCommitsMap.has(file)) {
            fileToCommitsMap.set(file, new Set());
          }
          fileToCommitsMap.get(file).add(index);
        });
      }
    });

    // Second pass: merge commits with overlapping files
    const mergedGroups = [];
    const processedCommits = new Set();

    result.commits.forEach((commit, index) => {
      if (processedCommits.has(index) || !commit.files || !commit.message) {
        return;
      }

      // Find all commits that share files with this one
      const relatedCommitIndices = new Set([index]);
      const filesToCheck = [...commit.files];
      const checkedFiles = new Set();

      while (filesToCheck.length > 0) {
        const file = filesToCheck.pop();
        if (checkedFiles.has(file)) continue;
        checkedFiles.add(file);

        const commitIndices = fileToCommitsMap.get(file);
        if (commitIndices) {
          commitIndices.forEach(commitIndex => {
            if (!relatedCommitIndices.has(commitIndex)) {
              relatedCommitIndices.add(commitIndex);
              // Add new files from this commit to check for more overlaps
              const newCommit = result.commits[commitIndex];
              if (newCommit.files) {
                newCommit.files.forEach(f => {
                  if (!checkedFiles.has(f)) {
                    filesToCheck.push(f);
                  }
                });
              }
            }
          });
        }
      }

      // Merge all related commits
      const allFiles = new Set();
      const allMessages = [];

      relatedCommitIndices.forEach(commitIndex => {
        const relatedCommit = result.commits[commitIndex];
        if (relatedCommit.files) {
          relatedCommit.files.forEach(f => allFiles.add(f));
        }
        if (relatedCommit.message) {
          allMessages.push(relatedCommit.message);
        }
        processedCommits.add(commitIndex);
      });

      if (allFiles.size > 0 && allMessages.length > 0) {
        mergedGroups.push({
          files: Array.from(allFiles),
          messages: allMessages
        });
      }
    });

    return { commits: mergedGroups };
  }

  return result;
}

export async function commit(jsonStr, options = {}) {
  const config = { ...getConfig(), ...options };

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (error) {
    throw new Error(`Invalid JSON input: ${error.message}`);
  }

  const commits = data.commits || (Array.isArray(data) ? data : [data]);

  if (!Array.isArray(commits) || commits.length === 0) {
    throw new Error('No commits found in input');
  }

  const gitPath = config.git || 'git';
  const confirmationFn = options.confirmation;
  const results = [];

  for (const commitData of commits) {
    // Handle both old format (message) and new format (messages)
    const messages = commitData.messages || (commitData.message ? [commitData.message] : []);

    if (messages.length === 0) {
      console.error('Skipping commit without messages');
      continue;
    }

    const files = commitData.files || [];

    if (files.length === 0) {
      console.error(`Skipping commit with messages "${messages.join(', ')}" - no files specified`);
      continue;
    }

    // Use the first message as the primary commit message, add others as additional context
    let commitMessage = messages[0];
    if (messages.length > 1) {
      // Add alternative messages as part of the commit body
      commitMessage = messages[0] + '\n' + messages.slice(1).map(m => '- ' + m).join('\n');
    }

    const commitCommand = `${gitPath} commit -m "${commitMessage.replace(/"/g, '\\"')}" ${files.map(f => `"${f}"`).join(' ')}`;

    if (confirmationFn && typeof confirmationFn === 'function') {
      const shouldProceed = await confirmationFn({
        message: commitMessage,
        files: files,
        command: commitCommand
      });
      
      if (!shouldProceed) {
        results.push({
          success: false,
          messages: messages,
          files: files,
          skipped: true,
          reason: 'User cancelled'
        });
        continue;
      }
    }

    try {
      // Stage all files (git add works for deletions too - it stages the deletion)
      for (const file of files) {
        execSync(`${gitPath} add "${file}"`, { encoding: 'utf8' });
      }

      const commitResult = execSync(commitCommand, { encoding: 'utf8' });

      results.push({
        success: true,
        messages: messages,
        files: files,
        output: commitResult
      });
    } catch (error) {
      results.push({
        success: false,
        messages: messages,
        files: files,
        error: error.message
      });
    }
  }

  return { results };
}