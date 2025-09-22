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
      console.warn('Skipping commit without message');
      continue;
    }

    const files = commitData.files || [];

    if (files.length === 0) {
      console.warn(`Skipping commit "${commitData.message}" - no files specified`);
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