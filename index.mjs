import { getConfig } from './lib/config.mjs';
import { createLLMProvider } from './lib/llm/index.mjs';
import { execSync } from 'child_process';
import { Readable } from 'stream';

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf-8');
}

export function getGitDiffStream(options = {}) {
  const config = { ...getConfig(), ...options };
  const gitPath = config.git || 'git';

  try {
    const gitStatus = execSync(`${gitPath} status --porcelain`, { encoding: 'utf8' });
    const gitDiff = execSync(`${gitPath} diff --staged`, { encoding: 'utf8' });

    if (!gitDiff || gitDiff.trim().length === 0) {
      const unstagedDiff = execSync(`${gitPath} diff`, { encoding: 'utf8' });

      if (!unstagedDiff || unstagedDiff.trim().length === 0) {
        throw new Error('No changes detected. Please stage your changes with "git add" or make some changes first.');
      }

      console.error('No staged changes found. Using unstaged changes instead.');
      console.error('Tip: Use "git add" to stage your changes before generating commit messages.\n');

      const combinedOutput = `Git Status:\n${gitStatus}\n\nGit Diff (Unstaged):\n${unstagedDiff}`;
      return createReadableStream(combinedOutput);
    } else {
      const combinedOutput = `Git Status:\n${gitStatus}\n\nGit Diff (Staged):\n${gitDiff}`;
      return createReadableStream(combinedOutput);
    }
  } catch (error) {
    if (error.message.includes('No changes detected')) {
      throw error;
    }
    throw new Error(`Error running git commands: ${error.message}. Make sure you are in a git repository.`);
  }
}

export async function generate(stream, options = {}) {
  const config = { ...getConfig(), ...options };

  if (!stream) {
    throw new Error('Stream is required');
  }

  const diff = await streamToString(stream);
  if (!diff || diff.trim().length === 0) {
    throw new Error('No diff content provided');
  }

  const provider = createLLMProvider(config);
  const result = await provider.generateCommitMessages(diff);

  return result;
}

export async function commit(stream, options = {}) {
  const config = { ...getConfig(), ...options };

  if (!stream) {
    throw new Error('Stream is required');
  }

  const jsonStr = await streamToString(stream);
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
  const results = [];

  for (const commitData of commits) {
    if (!commitData.message) {
      console.error('Skipping commit without message');
      continue;
    }

    const files = commitData.files || [];

    if (files.length === 0) {
      console.error(`Skipping commit "${commitData.message}" - no files specified`);
      continue;
    }

    try {
      for (const file of files) {
        execSync(`${gitPath} add "${file}"`, { encoding: 'utf8' });
      }
      console.log(`${gitPath} commit -m "${commitData.message.replace(/"/g, '\\"')}"`)
      const commitResult = execSync(
        `${gitPath} commit -m "${commitData.message.replace(/"/g, '\\"')}"`,
        { encoding: 'utf8' }
      );

      results.push({
        success: true,
        message: commitData.message,
        files: files,
        output: commitResult
      });
    } catch (error) {
      results.push({
        success: false,
        message: commitData.message,
        files: files,
        error: error.message
      });
    }
  }

  return { results };
}

export function createReadableStream(content) {
  return Readable.from(content);
}