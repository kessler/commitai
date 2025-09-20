export class BaseLLMProvider {
  constructor(config) {
    this.config = config;
  }

  async generateCommitMessages(diff) {
    throw new Error('generateCommitMessages must be implemented by subclass');
  }

  getSystemPrompt() {
    return `You are a helpful assistant that generates git commit messages from diffs.
Analyze the provided git diff and generate appropriate commit messages.

Return a JSON array where each object has:
- "message": a concise, descriptive commit message following conventional commit format
- "files": array of file paths that should be included in this commit

Group related changes together. If there are multiple logical changes, create multiple commit objects.

Example output:
[
  {
    "message": "feat: add user authentication module",
    "files": ["src/auth.js", "src/middleware/auth.js"]
  },
  {
    "message": "fix: correct typo in documentation",
    "files": ["README.md"]
  }
]

Focus on clarity and following git commit best practices.`;
  }
}