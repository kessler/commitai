import { OpenAIProvider } from './openai.mjs';
import { AnthropicProvider } from './anthropic.mjs';

export function createLLMProvider(config) {
  const provider = config.provider?.toLowerCase();

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    default:
      throw new Error(`Unknown provider: ${provider}. Supported providers: openai, anthropic`);
  }
}