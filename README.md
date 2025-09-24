# commitai

_module generated with AI_

Generate intelligent git commit messages from your staged changes using LLMs (OpenAI or Anthropic). CommitAI analyzes your git diff, groups related changes together, and generates conventional commit messages following best practices.

## Features

- 🤖 **Multiple LLM Support**: Works with both OpenAI (GPT) and Anthropic (Claude) models
- 🎯 **Smart Grouping**: Automatically groups related file changes into logical commits
- ✨ **Interactive Setup**: Simple onboarding wizard to configure your LLM provider
- 📝 **Conventional Commits**: Generates messages following conventional commit standards
- 🔄 **Flexible Workflow**: Use staged or unstaged changes, pipe diffs, or work directly with git
- ✅ **Confirmation Prompts**: Review and confirm commits before they're created
- 🔧 **Configurable**: Support for project-specific and global configurations

## Installation

```bash
npm install -g commitai
```

Or use locally in your project:

```bash
npm install commitai
```

## Quick Start

### 1. Run the interactive setup

```bash
commitai setup
```

This will guide you through:
- Selecting your preferred LLM provider (OpenAI or Anthropic)
- Entering your API key
- Choosing your preferred model

### 2. Generate and commit

```bash
# Stage your changes
git add .

# Generate and create commits with confirmation
commitai gen | commitai commit

# Or use shortcuts
commitai g | commitai c
```

## Configuration

Configuration is stored in `~/.config/commitai` (created by the setup wizard) or can be overridden with:

### Project-specific config (`.commitairc`)

```ini
provider = openai
model = gpt-4o-mini
apiKey = your-api-key-here
```

### Environment variables

- `OPENAI_API_KEY` for OpenAI
- `ANTHROPIC_API_KEY` for Anthropic

### Configuration hierarchy

1. Command-line options (highest priority)
2. Project `.commitairc` file
3. User config at `~/.config/commitai`
4. Environment variables (lowest priority)

## CLI Usage

### Interactive Setup

```bash
commitai setup
```

Launches an interactive wizard to configure CommitAI with your preferred LLM provider and model.

### Generate commit messages

```bash
# Generate from staged changes (recommended)
commitai generate

# Use aliases for convenience
commitai gen
commitai g

# Generate from unstaged changes (when no staged changes exist)
commitai g

# Provide diff via stdin
git diff | commitai g --stdin
```

Options:
- `-g, --git <path>`: Path to git executable
- `-p, --provider <provider>`: LLM provider (openai or anthropic)
- `-m, --model <model>`: Model to use
- `-k, --api-key <key>`: API key for the provider
- `--openai-api-key <key>`: OpenAI API key
- `--anthropic-api-key <key>`: Anthropic API key
- `--stdin`: Read diff from stdin instead of using git commands

### Create commits

```bash
# Generate and commit with confirmation prompts (default)
commitai g | commitai commit

# Skip confirmation prompts
commitai g | commitai c --no-confirm

# Using shorthand
commitai g | commitai c
```

Options:
- `-g, --git <path>`: Path to git executable
- `--no-confirm`: Skip confirmation prompts

### Show configuration

```bash
commitai config
```

Displays the current configuration including provider, model, and API key settings.

## API Usage

```javascript
import { generate, commit, getGitDiff } from 'commitai';

// Generate commit messages from current git state
const diff = getGitDiff();
const result = await generate(diff, {
  provider: 'openai',
  model: 'gpt-4o-mini'
});

// Result contains grouped commits
console.log(result.commits);
// [
//   {
//     files: ['src/auth.js', 'src/middleware/auth.js'],
//     messages: ['feat: add user authentication module']
//   },
//   {
//     files: ['README.md'],
//     messages: ['docs: update installation instructions']
//   }
// ]

// Create commits programmatically
const commitResult = await commit(JSON.stringify(result), {
  confirmation: async ({ message, files }) => {
    // Custom confirmation logic
    return true; // or false to skip
  }
});
```

## How It Works

1. **Diff Analysis**: CommitAI reads your git diff (staged or unstaged changes)
2. **Smart Grouping**: The LLM analyzes changes and groups related files together
3. **Message Generation**: Generates conventional commit messages for each group
4. **Overlap Detection**: Merges commit groups that share files to avoid conflicts
5. **Confirmation**: Shows you each commit before creating it (can be disabled)
6. **Commit Creation**: Stages the specific files and creates individual commits

## Supported Models

### OpenAI
- gpt-4o
- gpt-4o-mini
- gpt-4-turbo
- gpt-3.5-turbo
- Custom models via manual entry

### Anthropic
- claude-3-opus
- claude-3-sonnet
- claude-3-haiku
- claude-3.5-sonnet
- Custom models via manual entry

## Commit Message Format

CommitAI follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test updates
- `chore:` Build process or auxiliary tool changes
- `perf:` Performance improvements

## Tips

1. **Stage your changes first**: CommitAI works best with staged changes (`git add`)
2. **Review before committing**: Use the confirmation prompts to ensure accuracy
3. **Group related changes**: Stage related files together for better commit grouping
4. **Use .gitignore**: Ensure unwanted files aren't included in diffs
5. **Small, focused changes**: Make small, atomic changes for best results

## License

Apache-2.0