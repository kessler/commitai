import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { select, password, confirm, input } from '@inquirer/prompts';
import { createLLMProvider } from './llm/index.mjs';

export async function runOnboarding() {
  console.log('Welcome to CommitAI Setup!\n');
  console.log('This wizard will help you configure CommitAI for generating commit messages.\n');

  const config = {};

  // Select provider
  config.provider = await select({
    message: 'Select your LLM provider:',
    choices: [
      { name: 'anthropic', value: 'anthropic' },
      { name: 'openai', value: 'openai' }
    ]
  });
  console.log(`Selected provider: ${config.provider}\n`);

  // Get API key
  const keyPrompt = config.provider === 'openai'
    ? 'Enter your OpenAI API key:'
    : 'Enter your Anthropic API key:';

  config.apiKey = await password({
    message: keyPrompt
  });

  if (!config.apiKey) {
    console.error('Warning: No API key provided. You will need to set it later or use environment variables.');
    return false;
  }

  // Instantiate the appropriate provider to fetch models
  console.log('Fetching available models...');
  const provider = createLLMProvider(config)
  let models = [];
  console.log(config, provider)
  try {
    models = await provider.fetchAvailableModels();

    if (models.length === 0) {
      console.error('No models available. Please check your API key and try again.');
      return false;
    }
  } catch (error) {
    console.error(`Error fetching models: ${error.message}`);
    return false;
  }

  // Add custom option
  const modelChoices = [...models, 'Custom (enter manually)'];

  const modelResponse = await select({
    message: 'Select a model:',
    choices: modelChoices.map(choice => ({ name: choice, value: choice }))
  });

  if (modelResponse === 'Custom (enter manually)') {
    config.model = await input({
      message: 'Enter the model name:'
    });
  } else {
    config.model = modelResponse;
  }

  console.log(`Selected model: ${config.model}\n`);

  // Prepare config file path
  const configDir = path.join(os.homedir(), '.config');
  const configFile = path.join(configDir, 'commitai');

  // Check if config file exists
  try {
    await fs.access(configFile);
    const overwrite = await confirm({
      message: 'Configuration file already exists. Overwrite?'
    });

    if (!overwrite) {
      console.log('Setup cancelled.');
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

  return true;
}