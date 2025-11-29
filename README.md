# nullcommits 🚀

AI-powered git commit message enhancer using GPT-5.1. Transform your simple commit messages into clear, emoji-enhanced, professional descriptions that anyone can understand.

## Installation

```bash
npm install -g nullcommits
```

## Quick Start

```bash
# 1. Set your OpenAI API key
nullcommits config set-key sk-your-api-key-here

# 2. (Optional) Create a customizable template
nullcommits init

# 3. Install the hook in your git repo
cd your-project
nullcommits install

# 4. Commit as usual - messages are automatically enhanced!
git commit -m "fix bug"
```

## Commands

### `nullcommits config set-key <apiKey>`

Save your OpenAI API key to `~/.nullcommitsrc`:

```bash
nullcommits config set-key sk-your-api-key-here
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

### API Key

You have three options to configure your OpenAI API key:

**Option A: CLI Command (Recommended)**
```bash
nullcommits config set-key sk-your-api-key-here
```

**Option B: Environment Variable**
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

Add this to your `~/.bashrc`, `~/.zshrc`, or shell profile to make it permanent.

**Option C: Config File (Manual)**
Create/edit `~/.nullcommitsrc`:
```json
{
  "apiKey": "sk-your-api-key-here"
}
```

### Template Customization

nullcommits uses a template to instruct GPT-5.1 how to generate commit messages. You can customize this at both global and local (per-project) levels!

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

### Template Priority

Templates are loaded in this order (highest priority first):

1. **Local template** - `.nullcommits.template` in repository root
2. **Global template** - `~/.nullcommits.template` in home directory
3. **Bundled default** - Built into nullcommits package

This allows you to have a personal default template while overriding it for specific projects that need different formatting.

## Usage

Once installed, just commit as usual:

```bash
git add .
git commit -m "fix bug"
```

nullcommits will automatically enhance your commit message using GPT-5.1. Your simple "fix bug" might become:

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
4. GPT-5.1 generates an enhanced message with:
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
- OpenAI API key (with access to GPT-5.1)

## Troubleshooting

### "OpenAI API key not found"
Set your API key using one of these methods:
- Run: `nullcommits config set-key YOUR_API_KEY`
- Set `OPENAI_API_KEY` environment variable
- Create `~/.nullcommitsrc` with your key

### "Not a git repository"
Run `nullcommits install` from inside a git repository.

### "nullcommits hook is already installed"
The hook is already active in this repository. No action needed!

### API errors
- Verify your API key is valid
- Check you have sufficient API quota
- Ensure you have access to the GPT-5.1 model

## File Locations

| File | Purpose |
|------|---------|
| `~/.nullcommitsrc` | Stores your API key (JSON format) |
| `~/.nullcommits.template` | Your global custom template (created by `nullcommits init`) |
| `.nullcommits.template` | Local project-specific template (in repo root) |
| `.git/hooks/prepare-commit-msg` | The installed hook (per-repository) |

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.