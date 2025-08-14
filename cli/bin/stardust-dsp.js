#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCommand } from '../commands/create.js';
import { initCommand } from '../commands/init.js';
import { deployCommand } from '../commands/deploy.js';
import { configCommand } from '../commands/config.js';
import { devCommand } from '../commands/dev.js';
import { deliveriesCommand } from '../commands/deliveries.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json
const packageJson = JSON.parse(
  fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
);

console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════╗
║       Stardust DSP CLI v${packageJson.version.padEnd(14)}║
║   Your Streaming Platform Awaits 🎵   ║
╚═══════════════════════════════════════╝
`));

program
  .name('stardust-dsp')
  .description('CLI tool for creating and managing Stardust DSP streaming platforms')
  .version(packageJson.version);

// Register commands
program.addCommand(createCommand);
program.addCommand(initCommand);
program.addCommand(deployCommand);
program.addCommand(configCommand);
program.addCommand(devCommand);
program.addCommand(deliveriesCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}