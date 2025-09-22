import readline from 'readline';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function selectFromList(prompt, options) {
  console.log(prompt);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });

  while (true) {
    const answer = await question('Enter your choice (number): ');
    const choice = parseInt(answer);

    if (choice >= 1 && choice <= options.length) {
      return options[choice - 1];
    }

    console.log('Invalid choice. Please try again.');
  }
}

async function fetchOpenAIModels(apiKey) {
  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.models.list();

    const chatModels = response.data
      .filter(model => model.id.includes('gpt'))
      .map(model => model.id)
      .sort((a, b) => {
        if (a.includes('gpt-4') && !b.includes('gpt-4')) return -1;
        if (!a.includes('gpt-4') && b.includes('gpt-4')) return 1;
        return b.localeCompare(a);
      });

    return chatModels.length > 0 ? chatModels : ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
  } catch (error) {
    console.log('Unable to fetch models from OpenAI API. Using default list.');
    return ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
  }
}

async function fetchAnthropicModels(apiKey) {
  // Anthropic doesn't provide a models list API endpoint yet
  // Return default list of available models
  return getDefaultAnthropicModels();
}

function getDefaultAnthropicModels() {
  return [
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ];
}

export async function runOnboarding() {
  console.log('Welcome to CommitAI Setup!\n');
  console.log('This wizard will help you configure CommitAI for generating commit messages.\n');

  const config = {};

  // Select provider
  const providers = ['openai', 'anthropic'];
  config.provider = await selectFromList('Select your LLM provider:', providers);
  console.log(`Selected provider: ${config.provider}\n`);

  // Get API key
  const keyPrompt = config.provider === 'openai'
    ? 'Enter your OpenAI API key: '
    : 'Enter your Anthropic API key: ';

  config.apiKey = await question(keyPrompt);

  if (!config.apiKey) {
    console.log('Warning: No API key provided. You will need to set it later or use environment variables.');
  }
  console.log();

  // Select model
  console.log('Fetching available models...');
  let models;

  if (config.provider === 'openai') {
    models = await fetchOpenAIModels(config.apiKey);
  } else {
    models = await fetchAnthropicModels(config.apiKey);
  }

  models.push('Custom (enter manually)');

  const selectedModel = await selectFromList('Select a model:', models);

  if (selectedModel === 'Custom (enter manually)') {
    config.model = await question('Enter the model name: ');
  } else {
    config.model = selectedModel;
  }

  console.log(`Selected model: ${config.model}\n`);

  // Prepare config file path
  const configDir = path.join(os.homedir(), '.config');
  const configFile = path.join(configDir, 'commitai');

  // Check if config file exists
  try {
    await fs.access(configFile);
    const overwrite = await question('Configuration file already exists. Overwrite? (y/n): ');

    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return false;
    }
  } catch (error) {
    // File doesn't exist, which is fine
  }

  // Create directory if it doesn't exist
  await fs.mkdir(configDir, { recursive: true });

  // Write config file in rc format
  const rcContent = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  await fs.writeFile(configFile, rcContent, 'utf8');

  console.log(`\nConfiguration saved to ${configFile}`);
  console.log('\nSetup complete! You can now use CommitAI with your configured settings.');
  console.log('Run "commitai gen" to generate commit messages from git diffs.');

  rl.close();
  return true;
}