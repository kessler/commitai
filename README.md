# commitai

_module generated with AI_

Generate git commit messages from diffs using LLMs (OpenAI or Anthropic).

## Installation

```bash
npm install -g commitai
```

Or use locally:

```bash
npm install commitai
```

## Configuration

Create a `.commitairc` file in your home directory or project root:

```ini
provider = openai
model = gpt-4o-mini
apiKey = your-api-key-here
```

Or use environment variables:
- `OPENAI_API_KEY` for OpenAI
- `ANTHROPIC_API_KEY` for Anthropic

## CLI Usage

### Generate commit messages from a diff

```bash
git diff | commitai generate
# or use aliases
git diff | commitai gen
git diff | commitai g
```

Options:
- `-p, --provider <provider>`: LLM provider (openai or anthropic)
- `-m, --model <model>`: Model to use
- `-k, --api-key <key>`: API key

### Commit with generated messages

```bash
git diff | commitai generate | commitai commit
# or
git diff | commitai g | commitai c
```

### Show configuration

```bash
commitai config
```

## API Usage

```javascript
import { generate, commit, createReadableStream } from 'commitai';

// Generate commit messages
const diff = 'your git diff here...';
const stream = createReadableStream(diff);
const result = await generate(stream, {
  provider: 'openai',
  model: 'gpt-4o-mini'
});
console.log(result.commits);

// Create commits
const commitData = {
  commits: [
    {
      message: "feat: add new feature",
      files: ["src/feature.js"]
    }
  ]
};
const commitStream = createReadableStream(JSON.stringify(commitData));
await commit(commitStream);
```

## Supported Models

### OpenAI
- gpt-4o
- gpt-4o-mini
- gpt-4-turbo
- gpt-3.5-turbo

### Anthropic
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307

## License

Apache-2.0