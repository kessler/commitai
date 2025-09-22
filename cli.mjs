#!/usr/bin/env node

import { program } from 'commander';
import { generate, commit, getGitDiffStream } from './index.mjs';
import { getConfig } from './lib/config.mjs';
import { runOnboarding } from './lib/onboarding.mjs';
import { createReadStream } from 'fs';

program
  .name('commitai')
  .description('Generate git commit messages from diffs using LLMs')
  .version('1.0.0');

program
  .command('setup')
  .description('Run interactive setup to configure CommitAI')
  .action(async () => {
    try {
      await runOnboarding();
    } catch (error) {
      console.error('Error during setup:', error.message);
      process.exit(1);
    }
  });

program
  .command('generate')
  .alias('gen')
  .alias('g')
  .description('Generate commit messages from git diff (automatically uses git status and diff unless --stdin is provided)')
  .option('-g, --git <path>', 'Path to git executable')
  .option('-p, --provider <provider>', 'LLM provider (openai or anthropic)')
  .option('-m, --model <model>', 'Model to use')
  .option('-k, --api-key <key>', 'API key for the provider')
  .option('--openai-api-key <key>', 'OpenAI API key')
  .option('--anthropic-api-key <key>', 'Anthropic API key')
  .option('--stdin', 'Read diff from stdin instead of using git commands')
  .action(async (options) => {
    try {
      let inputStream;

      if (options.stdin) {
        inputStream = process.stdin;
      } else {
        try {
          inputStream = getGitDiffStream(options);
        } catch (error) {
          console.error(error.message);
          process.exit(1);
        }
      }

      const result = await generate(inputStream, options);
      console.log(JSON.stringify(result, null, 2));
      process.exit(0) // @TODO I still don't know why the process doesn't exit, initial inquiry did not yield anything apparent
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('commit')
  .alias('c')
  .description('Create git commits from JSON input')
  .option('-g, --git <path>', 'Path to git executable')
  .action(async (options) => {
    try {
      const result = await commit(process.stdin, options);
      
      for (const commitResult of result.results) {
        if (commitResult.success) {
          console.log(`✓ Committed: ${commitResult.message}`);
          console.log(`  Files: ${commitResult.files.join(', ')}`);
        } else {
          console.error(`✗ Failed: ${commitResult.message}`);
          console.error(`  Error: ${commitResult.error}`);
        }
      }

      const successful = result.results.filter(r => r.success).length;
      const failed = result.results.filter(r => !r.success).length;

      console.log(`\nSummary: ${successful} successful, ${failed} failed`);

      if (failed > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    const config = getConfig();
    console.log('Current configuration:');
    console.log(JSON.stringify(config, null, 2));
  });

program.parse(process.argv);