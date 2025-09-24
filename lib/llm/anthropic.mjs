import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from './base.mjs';

export class AnthropicProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey || config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async fetchAvailableModels() {
    // Use the Anthropic SDK's models.list method
    const response = await this.client.models.list();

    // Filter for Claude models and extract model IDs
    const models = response.data
      .filter(model => model.id.includes('claude'))
      .map(model => model.id);

    return models;
  }

  async generateCommitMessages(diff) {
    try {
      const response = await this.client.messages.create({
        model: this.config.model || 'claude-3-haiku-20240307',
        max_tokens: 1024,
        temperature: 0.3,
        system: this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: `Please analyze this git diff and generate appropriate commit messages. Return ONLY valid JSON:\n\n${diff}`
          }
        ],
      });

      const content = response.content[0].text;

      // Try to extract JSON object first
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      let parsed = JSON.parse(jsonMatch[0]);

      // Handle if response is already in correct format
      if (parsed.commits && Array.isArray(parsed.commits)) {
        return parsed;
      }

      // Handle if response is just an array
      if (Array.isArray(parsed)) {
        return { commits: parsed };
      }

      // Handle single commit object
      return { commits: [parsed] };
    } catch (error) {
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }
}