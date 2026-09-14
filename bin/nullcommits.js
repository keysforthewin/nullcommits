#!/usr/bin/env -S node --trace-deprecation

const { program } = require('commander');
const { install } = require('../src/commands/install');
const { uninstall } = require('../src/commands/uninstall');
const { init } = require('../src/commands/init');
const { setKey, setAnthropicKey, setModel, showModel, setProviders, showProviders, setDiffBudget, showDiffBudget } = require('../src/commands/config');
const { doctor } = require('../src/commands/doctor');
const { processCommitMessage } = require('../src/hook-runner');
const { GLOBAL_TEMPLATE_FILE, getTemplateInstructions } = require('../src/config');

program
  .name('nullcommits')
  .description('AI-powered git commit message generator: Claude Code / Codex subscriptions first, Anthropic / OpenAI APIs as fallback')
  .version(require('../package.json').version);

program
  .command('init')
  .description('Initialize nullcommits - creates global template file for customization')
  .action(async () => {
    try {
      const result = await init();
      if (result.created) {
        console.log('✅ nullcommits initialized!');
        console.log('');
        console.log('📝 Global template created at:');
        console.log(`   ${result.templatePath}`);
      } else {
        console.log('ℹ️  Global template already exists at:');
        console.log(`   ${result.templatePath}`);
      }
      console.log('');
      console.log('Edit this file to customize how your commit messages are generated.');
      console.log(getTemplateInstructions());
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install the nullcommits hook in the current git repository')
  .action(async () => {
    try {
      await install();
      console.log('✅ nullcommits hook installed successfully!');
      console.log('Your commit messages will now be enhanced with AI.');
      console.log('');
      console.log('💡 Tip: Run "nullcommits init" to create a customizable global template at:');
      console.log(`   ${GLOBAL_TEMPLATE_FILE}`);
      console.log(getTemplateInstructions());
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Remove the nullcommits hook from the current git repository')
  .action(async () => {
    try {
      await uninstall();
      console.log('✅ nullcommits hook removed successfully!');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Config subcommand group
const configCmd = program
  .command('config')
  .description('Manage nullcommits configuration');

configCmd
  .command('set-key <apiKey>')
  .description('Set your OpenAI API key (stored in ~/.nullcommitsrc)')
  .action(async (apiKey) => {
    try {
      const result = await setKey(apiKey);
      console.log('✅ API key saved successfully!');
      console.log(`   Config file: ${result.path}`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

configCmd
  .command('set-anthropic-key <apiKey>')
  .description('Set your Anthropic API key (stored in ~/.nullcommitsrc)')
  .action(async (apiKey) => {
    try {
      const result = await setAnthropicKey(apiKey);
      console.log('✅ Anthropic API key saved successfully!');
      console.log(`   Config file: ${result.path}`);
      console.log('');
      console.log('💡 The Anthropic API is used when the subscription CLIs are unavailable or exhausted.');
      console.log('   Check provider order with: nullcommits config show-providers');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

configCmd
  .command('set-model')
  .argument('<providerOrModel>', 'Provider name (claude-code, codex, anthropic, openai), or a model to set for anthropic')
  .argument('[model]', 'Model ID for that provider')
  .description('Set the model for a provider (e.g. set-model claude-code haiku, set-model codex gpt-5.3-codex-spark)')
  .action(async (providerOrModel, model) => {
    try {
      const result = await setModel(providerOrModel, model);
      console.log(`✅ ${result.provider} model set to ${result.model}`);
      console.log(`   Config file: ${result.path}`);
      console.log('');
      console.log('💡 You can also override per-shell or in .env with NULLCOMMITS_<PROVIDER>_MODEL,');
      console.log('   e.g. NULLCOMMITS_CLAUDE_CODE_MODEL, NULLCOMMITS_CODEX_MODEL, NULLCOMMITS_ANTHROPIC_MODEL, NULLCOMMITS_OPENAI_MODEL.');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

configCmd
  .command('show-model')
  .description('Show the model each provider will use and where the setting came from')
  .action(async () => {
    try {
      const { models } = await showModel();
      console.log('🤖 Provider models:');
      for (const m of models) {
        const note = m.source === 'default' ? '(default)' : `(${m.source})`;
        console.log(`   ${m.provider.padEnd(12)} ${m.model}  ${note}`);
      }
      console.log('');
      console.log('💡 Change with: nullcommits config set-model <provider> <model>');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

configCmd
  .command('set-providers <list>')
  .description('Set provider fallback order, comma separated (default: claude-code,codex,anthropic,openai)')
  .action(async (list) => {
    try {
      const result = await setProviders(list);
      console.log(`✅ Provider order set to ${result.providers.join(' → ')}`);
      console.log(`   Config file: ${result.path}`);
      console.log('');
      console.log('💡 You can also override per-shell or in .env with NULLCOMMITS_PROVIDERS.');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

configCmd
  .command('show-providers')
  .description('Show the provider fallback order')
  .action(async () => {
    try {
      const result = await showProviders();
      console.log(`🔀 Provider order: ${result.providers.join(' → ')}`);
      console.log(`   (from ${result.source})`);
      console.log('');
      console.log('💡 Change with: nullcommits config set-providers <list>');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

configCmd
  .command('set-diff-budget <budget>')
  .description('Set max characters for diff (e.g., 128000 or 128K). Default: 128K')
  .action(async (budget) => {
    try {
      const result = await setDiffBudget(budget);
      const formatted = result.budget >= 1000
        ? `${Math.floor(result.budget / 1000)}K`
        : result.budget;
      console.log(`✅ Diff budget set to ${result.budget} characters (${formatted})`);
      console.log(`   Config file: ${result.path}`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

configCmd
  .command('show-diff-budget')
  .description('Show the current diff budget setting')
  .action(async () => {
    try {
      const result = await showDiffBudget();
      const formatted = result.budget >= 1000
        ? `${Math.floor(result.budget / 1000)}K`
        : result.budget;
      console.log(`📊 Current diff budget: ${result.budget} characters (${formatted})`);
      if (result.isDefault) {
        console.log('   (using default value)');
      }
      console.log('');
      console.log('💡 Change with: nullcommits config set-diff-budget <value>');
      console.log('   Examples: 64000, 128K, 256000');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check which providers are usable right now, their models, and plan usage')
  .action(async () => {
    try {
      console.log('🩺 Checking providers (this makes one tiny request per subscription CLI)...');
      console.log('');
      const report = await doctor();
      console.log(`   Config file: ${report.configFile}`);
      console.log(`   .env files loaded: ${report.envFiles.length ? report.envFiles.join(', ') : 'none'}`);
      console.log('');
      let anyUsable = false;
      for (const p of report.providers) {
        const usable = p.configured && (!p.status || p.status.loggedIn);
        anyUsable = anyUsable || usable;
        const icon = usable ? '✅' : (p.configured ? '⚠️ ' : '⏭️ ');
        console.log(`${icon} ${p.name.padEnd(12)} model: ${p.model} (${p.modelSource})`);
        if (!p.configured) {
          console.log('               not configured (binary missing or no API key) — skipped');
        } else if (p.status) {
          if (p.status.error) {
            console.log(`               ${p.status.error}`);
          }
          if (p.status.utilization) {
            const u = p.status.utilization;
            const pct = w => (u[w] ? `${Math.round(u[w].utilization * 100)}%` : 'n/a');
            console.log(`               plan usage: 5h window ${pct('five_hour')}, 7d window ${pct('seven_day')}`);
          }
          if (p.status.model && p.status.model !== p.model) {
            console.log(`               resolved model: ${p.status.model}`);
          }
        }
      }
      console.log('');
      if (!anyUsable) {
        console.log('❌ No provider is usable right now. See messages above.');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Hidden command used by the git hook
program
  .command('process')
  .description('Process a commit message (used internally by git hook)')
  .argument('<msgFile>', 'Path to the commit message file')
  .action(async (msgFile) => {
    try {
      await processCommitMessage(msgFile);
    } catch (error) {
      console.error('❌ nullcommits error:', error.message);
      process.exit(1);
    }
  });

program.parse();