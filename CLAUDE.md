# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

nullcommits is a Node.js CLI tool that installs a `prepare-commit-msg` git hook to automatically generate commit messages. Providers are tried in a configurable chain, default `claude-code → codex → anthropic → openai`: the first two shell out to the locally installed Claude Code / Codex CLIs and spend the user's subscription; the last two call the Anthropic / OpenAI APIs and act as the fallback when a plan is depleted. Every provider defaults to a cheap model (haiku, gpt-5.3-codex-spark, claude-haiku-4-5, gpt-5.4-mini). The hook only acts when the commit message is blank (after stripping `#` comment lines) — any non-blank message, whether written by a user or a coding agent, is left untouched. Generated messages get an emoji, clear description, and detail about what changed.

## Commands

- **Run CLI locally:** `node bin/nullcommits.js <command>`
- **Install globally (for testing):** `npm install -g .` then use `nullcommits <command>`
- **No test suite exists** — `npm test` is a placeholder that exits with error

## Architecture

The entry point is `bin/nullcommits.js`, which uses Commander to define the CLI. The flow:

1. **CLI layer** (`bin/nullcommits.js`) — defines commands: `init`, `install`, `uninstall`, `config`, `doctor`, and the hidden `process` command used by the git hook
2. **Hook runner** (`src/hook-runner.js`) — called by `process`; reads the commit message file, gets the staged diff, then loops over `config.providers` via the `PROVIDERS` registry. Each provider module exports `generateCommitMessage()` and `isConfigured(config)`; unconfigured ones are skipped silently, failing ones log a one-line warning and fall through
3. **Prompt assembly** (`src/prompt.js`) — shared `buildPrompt()` (system prompt + authorship policy, filled template) and `cleanMessage()`
4. **CLI plumbing** (`src/cli-provider.js`) — `runCli()` child-process helper with timeout, `isOnPath()`, `classifyCliFailure()`, and the typed errors `ProviderUnavailableError` (binary/key missing, not logged in) and `ProviderExhaustedError` (plan or quota depleted, 429)
5. **Claude Code provider** (`src/claude-code.js`) — runs `claude -p --output-format json --tools "" --setting-sources "" --strict-mcp-config --no-session-persistence --model <claudeCodeModel>`; parses the JSON event array and treats a `rate_limit_event` with status other than `allowed`, or an error result mentioning limits, as exhausted. Never use `--bare`: it skips keychain reads and reports "Not logged in"
6. **Codex provider** (`src/codex.js`) — runs `codex exec --skip-git-repo-check -s read-only --ephemeral -m <codexModel> -o <tmpfile> -` with the prompt on stdin, reads the final message from the temp file, classifies failures from stderr text. ChatGPT-plan logins reject `*-mini` models; `gpt-5.3-codex-spark` is the small one that works
7. **Anthropic integration** (`src/anthropic.js`) — Anthropic SDK with prompt caching on the stable prefix (API fallback)
8. **OpenAI integration** (`src/openai.js`) — OpenAI SDK (API fallback)
9. **Config management** (`src/config.js`) — loads repo `.env` then `~/.nullcommits.env` via `process.loadEnvFile` (exported vars win), merges `~/.nullcommitsrc` (JSON: providers, per-provider models, bins, keys, diffBudget, cliTimeoutMs) under env overrides, validates the provider list, and records each key's source for display. `loadConfig()` no longer throws when no API key is set. Template loading keeps its 3-tier priority (local `.nullcommits.template` > global `~/.nullcommits.template` > bundled `templates/default.txt`)
10. **Git utilities** (`src/git.js`) — smart diff collection with budget allocation across files, media file detection, hook script generation
11. **Command implementations** (`src/commands/`) — `install.js`, `uninstall.js`, `init.js`, `config.js` (keys, providers, per-provider models, diff budget), `doctor.js` (per-provider availability, model + source, Claude plan utilization)

### Key Design Decisions

- The git hook calls `nullcommits process <msgFile>` — the CLI must be globally installed for the hook to work
- Subscription CLIs run headless in the OS temp dir with tools, settings files, MCP servers and session persistence disabled, so a repo's CLAUDE.md or hooks cannot influence the generated message
- Config precedence: exported env > repo `.env` > `~/.nullcommits.env` > `~/.nullcommitsrc` > defaults. Env var names are `NULLCOMMITS_PROVIDERS`, `NULLCOMMITS_<PROVIDER>_MODEL`, `NULLCOMMITS_<PROVIDER>_BIN`, `NULLCOMMITS_CLI_TIMEOUT_MS`
- Cheap models are deliberate defaults; do not bump them to flagship models
- Diff budget (default 128K chars) is split equally among staged files, with unused budget redistributed to larger files
- Media files (images/video/audio) are listed by name only, not diffed
- When 10+ lines change, a multi-line instruction is injected into the prompt requesting detailed bullet-point commit messages
- Template variables: `{{ORIGINAL_MESSAGE}}`, `{{DIFF}}`, `{{MULTI_LINE_INSTRUCTION}}`
- Any non-blank commit message is skipped by the hook (which also covers merge, revert, fixup, and squash commits)

## Dependencies

Three runtime dependencies: `commander` (CLI framework), `@anthropic-ai/sdk` (Anthropic API client), and `openai` (OpenAI API client). `.env` loading uses Node's built-in `process.loadEnvFile` (Node >= 20.12), so no dotenv. Pure CommonJS, no build step.
