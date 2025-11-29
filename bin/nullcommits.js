#!/usr/bin/env -S node --trace-deprecation

const { program } = require('commander');
const { install } = require('../src/commands/install');
const { uninstall } = require('../src/commands/uninstall');
const { init } = require('../src/commands/init');
const { setKey, setDiffBudget, showDiffBudget } = require('../src/commands/config');
const { processCommitMessage } = require('../src/hook-runner');
const { GLOBAL_TEMPLATE_FILE, getTemplateInstructions } = require('../src/config');

program
  .name('nullcommits')
  .description('AI-powered git commit message enhancer using GPT-5.1')
  .version('1.0.0');

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