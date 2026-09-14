# Pushing p

```bash
alias p='git add *; git commit -m ""; git push'
```

And shout out to Bud Swayze on https://kick.com/budswayze - mention my nu11y sent you for 50% off subs!

# nullcommits 🚀

AI-powered git commit message generator. Commit with a blank message and nullcommits writes a clear, emoji-enhanced, professional one from your staged diff.

It spends your **Claude or ChatGPT subscription first** (through the locally installed Claude Code or Codex CLIs) and falls back to the **Anthropic / OpenAI APIs** only when a plan is depleted or unavailable. Every provider defaults to its cheapest suitable model.

## Installation

```bash
npm install -g nullcommits
```

## Quick Start

```bash
# 1. Make sure at least one provider works. Subscription CLIs need no key:
#    claude   (Claude Code, logged in to your Claude plan)
#    codex    (Codex CLI, logged in to your ChatGPT plan)
#    Optional API fallbacks:
nullcommits config set-anthropic-key sk-ant-your-api-key-here
nullcommits config set-key sk-your-openai-key-here
nullcommits doctor   # shows what is usable right now

# 2. (Optional) Create a customizable template
nullcommits init

# 3. Install the hook in your git repo
cd your-project
nullcommits install

# 4. Commit with a blank message - one is generated for you!
git commit --allow-empty-message -m ""
```

## Commands

### `nullcommits doctor`

Check every provider in your chain: whether it is installed / configured / logged in, which model it will use and where that setting came from, and (for Claude Code) your current plan usage. Makes one tiny request per subscription CLI.

```bash
nullcommits doctor
```

### `nullcommits config set-providers <list>`

Set the fallback order. Providers are tried left to right until one returns a message:

```bash
nullcommits config set-providers claude-code,codex,anthropic,openai   # default
nullcommits config set-providers codex,openai                          # ChatGPT plan only, OpenAI API fallback
```

### `nullcommits config show-providers`

Show the current provider order and where it came from.

### `nullcommits config set-model <provider> <model>`

Set the model a provider uses. Defaults are the cheapest suitable model for each:

```bash
nullcommits config set-model claude-code haiku
nullcommits config set-model codex gpt-5.3-codex-spark
nullcommits config set-model anthropic claude-haiku-4-5
nullcommits config set-model openai gpt-5.4-mini
```

`set-model <model>` with no provider still sets the Anthropic API model, for backward compatibility.

### `nullcommits config show-model`

Show the model each provider will use and whether it came from the environment, the config file, or the default.

### `nullcommits config set-anthropic-key <apiKey>`

Save your Anthropic API key to `~/.nullcommitsrc`. Used by the `anthropic` provider (API fallback):

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

### Providers

| Provider | Pays with | Needs | Default model |
|----------|-----------|-------|---------------|
| `claude-code` | Claude subscription | `claude` CLI on PATH, logged in | `haiku` |
| `codex` | ChatGPT subscription | `codex` CLI on PATH, logged in | `gpt-5.3-codex-spark` |
| `anthropic` | Anthropic API credits | `ANTHROPIC_API_KEY` | `claude-haiku-4-5` |
| `openai` | OpenAI API credits | `OPENAI_API_KEY` | `gpt-5.4-mini` |

Default order is `claude-code → codex → anthropic → openai`. A provider that is not installed or has no key is skipped silently. A provider whose plan is depleted, rate limited, or otherwise fails prints a one-line warning to stderr and the next one is tried. The commit only fails if every provider fails.

The subscription CLIs run headless with tools disabled, project settings ignored, no MCP servers, and no saved session, so a repo's own CLAUDE.md or hooks never influence the message. Note that Codex on a ChatGPT plan only accepts the models offered in its own model picker; the `*-mini` API models are rejected.

### `.env` files

Git hooks only inherit the environment of the shell running `git commit`, so nullcommits loads two `.env` files itself (Node's built-in loader, no dependency):

1. `.env` in the repository root
2. `~/.nullcommits.env` in your home directory

Priority, highest first: exported shell variables → repo `.env` → `~/.nullcommits.env` → `~/.nullcommitsrc` → built-in defaults. Example `~/.nullcommits.env`:

```bash
NULLCOMMITS_PROVIDERS=claude-code,codex,anthropic,openai
NULLCOMMITS_CLAUDE_CODE_MODEL=haiku
NULLCOMMITS_CODEX_MODEL=gpt-5.3-codex-spark
NULLCOMMITS_ANTHROPIC_MODEL=claude-haiku-4-5
NULLCOMMITS_OPENAI_MODEL=gpt-5.4-mini
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### API Keys (fallback providers)

#### Anthropic

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

Once installed, commit with a blank message whenever you want one generated:

```bash
git add .
git commit --allow-empty-message -m ""
```

nullcommits will generate a commit message from your staged diff using the first working provider in your chain. If you (or your coding agent) provide a non-blank message, nullcommits leaves it completely untouched — it only steps in when the message is empty. A blank commit might become:

```
🐛 Fix critical authentication bypass vulnerability

Resolved an issue where users could bypass login validation by submitting
empty credentials. Added proper null checks and improved error handling
to ensure all authentication attempts are properly validated.
```

## How It Works

1. You run `git commit` with a blank message
2. Git triggers the `prepare-commit-msg` hook
3. nullcommits checks the message — if you wrote one, it exits immediately without touching it
4. If the message is blank, it reads the staged diff and the first working provider (Claude Code → Codex → Anthropic API → OpenAI API by default) generates a message with:
   - Relevant emoji
   - Clear, descriptive summary
   - Explanation of what changed and why
5. The generated message is written to the commit
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

- Node.js 20.12.0 or higher
- Git
- At least one of: Claude Code CLI (logged in), Codex CLI (logged in), Anthropic API key, OpenAI API key

## Troubleshooting

### "No usable provider found"
Run `nullcommits doctor`. Then either log in to a subscription CLI (`claude` or `codex`) or set an API key:
- Run: `nullcommits config set-anthropic-key YOUR_KEY`
- Or: `nullcommits config set-key YOUR_OPENAI_KEY`
- Or set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in your shell, repo `.env`, or `~/.nullcommits.env`

### "claude-code exhausted" / "codex exhausted" warnings
Your plan window is used up; nullcommits already fell through to the next provider. `nullcommits doctor` shows Claude plan utilization. Reorder with `nullcommits config set-providers` if you want a different preference.

### "Not a git repository"
Run `nullcommits install` from inside a git repository.

### "nullcommits hook is already installed"
The hook is already active in this repository. No action needed!

### API errors
- Verify your API key is valid
- Check you have sufficient API quota
- Any failing provider is skipped and the next one in the chain is tried

## File Locations

| File | Purpose |
|------|---------|
| `~/.nullcommitsrc` | Stores your API keys, provider order, models and diff budget (JSON format) |
| `~/.nullcommits.env` | Global `.env` loaded by the hook (see `.env` files above) |
| `.env` | Repo-local `.env` loaded by the hook, wins over the global one |
| `~/.nullcommits.template` | Your global custom template (created by `nullcommits init`) |
| `.nullcommits.template` | Local project-specific template (in repo root) |
| `.git/hooks/prepare-commit-msg` | The installed hook (per-repository) |

## Environment Variables

All of these can be exported in your shell or placed in a repo `.env` / `~/.nullcommits.env`.

| Variable | Description | Default |
|----------|-------------|---------|
| `NULLCOMMITS_PROVIDERS` | Comma-separated fallback order | `claude-code,codex,anthropic,openai` |
| `NULLCOMMITS_CLAUDE_CODE_MODEL` | Model passed to `claude --model` | `haiku` |
| `NULLCOMMITS_CODEX_MODEL` | Model passed to `codex -m` | `gpt-5.3-codex-spark` |
| `NULLCOMMITS_ANTHROPIC_MODEL` | Anthropic API model | `claude-haiku-4-5` |
| `NULLCOMMITS_OPENAI_MODEL` | OpenAI API model | `gpt-5.4-mini` |
| `NULLCOMMITS_CLAUDE_CODE_BIN` | Path or name of the Claude Code binary | `claude` |
| `NULLCOMMITS_CODEX_BIN` | Path or name of the Codex binary | `codex` |
| `NULLCOMMITS_CLI_TIMEOUT_MS` | Kill a hung CLI after this long | `60000` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | - |
| `OPENAI_API_KEY` | Your OpenAI API key | - |
| `NULLCOMMITS_DIFF_BUDGET` | Max characters for diff | 128000 |

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
