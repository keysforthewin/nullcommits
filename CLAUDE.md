# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

nullcommits is a Node.js CLI tool that installs a `prepare-commit-msg` git hook to automatically enhance commit messages using Claude Sonnet (preferred) or OpenAI GPT-5.4 (fallback). Users write a simple commit message, and the hook rewrites it with an emoji, clearer description, and detail about what changed.

## Commands

- **Run CLI locally:** `node bin/nullcommits.js <command>`
- **Install globally (for testing):** `npm install -g .` then use `nullcommits <command>`
- **No test suite exists** — `npm test` is a placeholder that exits with error

## Architecture

The entry point is `bin/nullcommits.js`, which uses Commander to define the CLI. The flow:

1. **CLI layer** (`bin/nullcommits.js`) — defines commands: `init`, `install`, `uninstall`, `config`, and the hidden `process` command used by the git hook
2. **Hook runner** (`src/hook-runner.js`) — called by `process` command; reads the commit message file, gets the staged diff, calls the AI provider (Anthropic first, OpenAI fallback), writes the enhanced message back
3. **Anthropic integration** (`src/anthropic.js`) — sends the prompt to `claude-sonnet-4-20250514` via the Anthropic SDK (preferred provider)
4. **OpenAI integration** (`src/openai.js`) — sends the prompt to `gpt-5.4` via the OpenAI SDK (fallback provider)
5. **Config management** (`src/config.js`) — handles `~/.nullcommitsrc` (JSON with anthropicApiKey, apiKey, diffBudget), template loading with 3-tier priority (local `.nullcommits.template` > global `~/.nullcommits.template` > bundled `templates/default.txt`)
6. **Git utilities** (`src/git.js`) — smart diff collection with budget allocation across files, media file detection, hook script generation
7. **Command implementations** (`src/commands/`) — `install.js`, `uninstall.js`, `init.js`, `config.js`

### Key Design Decisions

- The git hook calls `nullcommits process <msgFile>` — the CLI must be globally installed for the hook to work
- Diff budget (default 128K chars) is split equally among staged files, with unused budget redistributed to larger files
- Media files (images/video/audio) are listed by name only, not diffed
- When 10+ lines change, a multi-line instruction is injected into the prompt requesting detailed bullet-point commit messages
- Template variables: `{{ORIGINAL_MESSAGE}}`, `{{DIFF}}`, `{{MULTI_LINE_INSTRUCTION}}`
- Special commits (merge, revert, fixup, squash) are skipped by the hook

## Dependencies

Three runtime dependencies: `commander` (CLI framework), `@anthropic-ai/sdk` (Anthropic API client), and `openai` (OpenAI API client). Pure CommonJS, no build step.
