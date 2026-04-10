# Pushing p

```bash
alias p='git add *; git commit -m ""; git push'
```

And shout out to Bud Swayze on https://kick.com/budswayze - mention my nu11y sent you for 50% off subs!

# nullcommits 🚀

AI-powered git commit message enhancer using Claude Sonnet & GPT-5.4. Transform your simple commit messages into clear, emoji-enhanced, professional descriptions that anyone can understand.

## Installation

```bash
npm install -g nullcommits
```

## Quick Start

```bash
# 1. Set your API key (Anthropic recommended, OpenAI also supported)
nullcommits config set-anthropic-key sk-ant-your-api-key-here
# OR: nullcommits config set-key sk-your-openai-key-here

# 2. (Optional) Create a customizable template
nullcommits init

# 3. Install the hook in your git repo
cd your-project
nullcommits install

# 4. Commit as usual - messages are automatically enhanced!
git commit -m "fix bug"
```

## Commands

### `nullcommits config set-anthropic-key <apiKey>`

Save your Anthropic API key to `~/.nullcommitsrc`. When set, Claude Sonnet is used as the primary AI provider with automatic fallback to OpenAI if the Anthropic call fails:

```bash
nullcommits config set-anthropic-key sk-ant-your-api-key-here
```

### `nullcommits config set-key <apiKey>`

Save your OpenAI API key to `~/.nullcommitsrc`:

```bash
nullcommits config set-key sk-your-api-key-here
```

### `nullcommits config set-diff-budget <budget>`

Set the maximum characters for diff collection (default: 128K). Supports K suffix:

```bash
# Set to 256,000 characters
nullcommits config set-diff-budget 256K

# Or use exact number
nullcommits config set-diff-budget 64000
```

### `nullcommits config show-diff-budget`

Show the current diff budget setting:

```bash
nullcommits config show-diff-budget
```

### `nullcommits init`

Create a global template file at `~/.nullcommits.template` that you can customize:

```bash
nullcommits init
```

This creates the template file and shows you its location along with available template variables. Edit this file to customize how your commit messages are generated.

### `nullcommits install`

Install the nullcommits hook in the current git repository:

```bash
cd your-project
nullcommits install
```

### `nullcommits uninstall`

Remove the nullcommits hook from the current git repository:

```bash
nullcommits uninstall
```

## Configuration

### API Keys

nullcommits supports two AI providers. When both keys are configured, **Claude Sonnet is used by default** with automatic fallback to OpenAI if the Anthropic call fails.

#### Anthropic (Recommended)

**Option A: CLI Command**
```bash
nullcommits config set-anthropic-key sk-ant-your-api-key-here
```

**Option B: Environment Variable**
```bash
export ANTHROPIC_API_KEY="sk-ant-your-api-key-here"
```

#### OpenAI

**Option A: CLI Command**
```bash
nullcommits config set-key sk-your-api-key-here
```

**Option B: Environment Variable**
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

Add environment variables to your `~/.bashrc`, `~/.zshrc`, or shell profile to make them permanent.

**Config File (Manual)**

Create/edit `~/.nullcommitsrc`:
```json
{
  "anthropicApiKey": "sk-ant-your-api-key-here",
  "apiKey": "sk-your-openai-key-here"
}
```

### Template Customization

nullcommits uses a template to instruct the AI how to generate commit messages. You can customize this at both global and local (per-project) levels!

**Create a global template:**
```bash
nullcommits init
```

This creates `~/.nullcommits.template` which you can edit freely.

**Create a local (project-specific) template:**
```bash
cp ~/.nullcommits.template .nullcommits.template
```

Place `.nullcommits.template` in the root of your repository for project-specific customization.

### Template Variables

The template supports these variables that get replaced at runtime:

| Variable | Description |
|----------|-------------|
| `{{ORIGINAL_MESSAGE}}` | The original commit message you provided |
| `{{DIFF}}` | The git diff of staged changes |
| `{{MULTI_LINE_INSTRUCTION}}` | Auto-injected when 10+ lines changed |

### Template Priority

Templates are loaded in this order (highest priority first):

1. **Local template** - `.nullcommits.template` in repository root
2. **Global template** - `~/.nullcommits.template` in home directory
3. **Bundled default** - Built into nullcommits package

This allows you to have a personal default template while overriding it for specific projects that need different formatting.

### Diff Budget

nullcommits uses intelligent diff collection to ensure large commits don't exceed API token limits. The diff budget (default: 128K characters) is divided equally among files, with unused budget redistributed to files that need more space.

**Configure via CLI:**
```bash
nullcommits config set-diff-budget 256K
```

**Or via environment variable:**
```bash
export NULLCOMMITS_DIFF_BUDGET=256000
```

**Or in config file `~/.nullcommitsrc`:**
```json
{
  "apiKey": "sk-your-api-key-here",
  "diffBudget": 256000
}
```

### Smart Diff Features

- **Media file handling**: Binary files (images, videos, audio) show only filenames, not diff content
- **Budget redistribution**: Files with smaller diffs share their unused budget with larger files
- **Multi-line commits**: When 10+ lines are changed, the AI is instructed to create detailed multi-line commit messages

**Supported media extensions (filename only, no diff):**
- Images: `.png`, `.gif`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.ico`, `.bmp`, `.tiff`, `.tif`, `.avif`
- Video: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.wmv`, `.flv`, `.m4v`
- Audio: `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma`

## Usage

Once installed, just commit as usual:

```bash
git add .
git commit -m "fix bug"
```

nullcommits will automatically enhance your commit message using Claude Sonnet (or GPT-5.4 as fallback). Your simple "fix bug" might become:

```
🐛 Fix critical authentication bypass vulnerability

Resolved an issue where users could bypass login validation by submitting
empty credentials. Added proper null checks and improved error handling
to ensure all authentication attempts are properly validated.
```

## How It Works

1. You run `git commit -m "your message"`
2. Git triggers the `prepare-commit-msg` hook
3. nullcommits reads your message and the staged diff
4. Claude Sonnet (or GPT-5.4 fallback) generates an enhanced message with:
   - Relevant emoji
   - Clear, descriptive summary
   - Explanation of what changed and why
5. The enhanced message replaces your original
6. Commit completes seamlessly

## Uninstalling

To remove the hook from a repository:

```bash
nullcommits uninstall
```

To completely remove nullcommits:

```bash
npm uninstall -g nullcommits
```

## Requirements

- Node.js 18.0.0 or higher
- Git
- Anthropic API key (recommended) and/or OpenAI API key

## Troubleshooting

### "No API key found"
Set at least one API key:
- Run: `nullcommits config set-anthropic-key YOUR_KEY` (recommended)
- Or: `nullcommits config set-key YOUR_OPENAI_KEY`
- Or set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` environment variable

### "Not a git repository"
Run `nullcommits install` from inside a git repository.

### "nullcommits hook is already installed"
The hook is already active in this repository. No action needed!

### API errors
- Verify your API key is valid
- Check you have sufficient API quota
- If Anthropic fails, nullcommits will automatically fall back to OpenAI (if configured)

## File Locations

| File | Purpose |
|------|---------|
| `~/.nullcommitsrc` | Stores your API keys and diff budget (JSON format) |
| `~/.nullcommits.template` | Your global custom template (created by `nullcommits init`) |
| `.nullcommits.template` | Local project-specific template (in repo root) |
| `.git/hooks/prepare-commit-msg` | The installed hook (per-repository) |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (preferred) | - |
| `OPENAI_API_KEY` | Your OpenAI API key (fallback) | - |
| `NULLCOMMITS_DIFF_BUDGET` | Max characters for diff | 128000 |

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
