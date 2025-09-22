import OpenAI from 'openai';
import { BaseLLMProvider } from './base.mjs';

export class OpenAIProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey || config.openaiApiKey || process.env.OPENAI_API_KEY,
    });
  }

  async generateCommitMessages(diff) {
    try {

      const response = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: `Please analyze this git diff and generate appropriate commit messages:\n\n${diff}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        return { commits: [parsed] };
      }

      return { commits: parsed };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}