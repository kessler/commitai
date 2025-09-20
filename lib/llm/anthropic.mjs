import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from './base.mjs';

export class AnthropicProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey || config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });
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

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return { commits: parsed };
    } catch (error) {
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }
}