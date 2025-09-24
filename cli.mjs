#!/usr/bin/env node

import { program } from 'commander';
import { generate, commit, getGitDiff, streamToString } from './index.mjs';
import { getConfig } from './lib/config.mjs';
import { runOnboarding } from './lib/onboarding.mjs';
import { confirm } from '@inquirer/prompts';
import tty from 'tty'
import { openSync } from 'fs'

program
  .name('commitai')
  .description('Generate git commit messages from diffs using LLMs')
  .version('1.0.0');

program
  .command('setup')
  .description('Run interactive setup to configure CommitAI')
  .action(async () => {
    await runOnboarding();
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
    let diff;

    if (options.stdin) {
      diff = await streamToString(process.stdin);
    } else {
      diff = getGitDiff(options);
    }
    
    const result = await generate(diff, options);
    
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('commit')
  .alias('c')
  .description('Create git commits from JSON input')
  .option('-g, --git <path>', 'Path to git executable')
  .option('--no-confirm', 'Skip confirmation prompts')
  .action(async (options) => {
    const commitOptions = { ...options };
    
    if (options.confirm !== false) {
      commitOptions.confirmation = async ({ message, files, command }) => {
        console.log('\n' + '─'.repeat(50));
        console.log('Commit message:\n', message);
        console.log('Files to commit:\n', files.join(', '));
        console.log('Command:\n', command);
        console.log('─'.repeat(50));
        
        let input = process.stdin
        if (!input.isTTY) {
          const fd = openSync('/dev/tty', 'r+');
          input = new tty.ReadStream(fd);
        }
        
        const answer = await confirm({
          message: 'Proceed with this commit?'
        }, { input });

        return answer;
      }; 
    }

    const jsonStr = await streamToString(process.stdin);
    const result = await commit(jsonStr, commitOptions);

    for (const commitResult of result.results) {
      const displayMessage = commitResult.messages ? commitResult.messages[0] : commitResult.message;
      if (commitResult.success) {
        console.log(`✓ Committed: ${displayMessage}`);
        if (commitResult.messages && commitResult.messages.length > 1) {
          console.log(`  (with ${commitResult.messages.length - 1}\n${commitResult.messages.length > 2 ? 's' : ''})`);
        }
        console.log(`  Files: ${commitResult.files.join(', ')}`);
      } else if (commitResult.skipped) {
        console.log(`⊘ Skipped: ${displayMessage}`);
        console.log(`  Reason: ${commitResult.reason}`);
      } else {
        console.error(`✗ Failed: ${displayMessage}`);
        console.error(`  Error: ${commitResult.error}`);
      }
    }

    const successful = result.results.filter(r => r.success).length;
    const failed = result.results.filter(r => !r.success && !r.skipped).length;
    const skipped = result.results.filter(r => r.skipped).length;

    console.log(`\nSummary: ${successful} successful, ${failed} failed, ${skipped} skipped`);

    if (failed > 0) {
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