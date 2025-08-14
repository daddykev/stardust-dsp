import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';

export const initCommand = new Command('init')
  .description('Initialize Firebase and configure your DSP')
  .option('--skip-firebase', 'Skip Firebase initialization')
  .action(async (options) => {
    console.log(chalk.cyan('🚀 Initializing your Stardust DSP...\n'));

    try {
      // Check if we're in a DSP project
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        console.error(chalk.red('❌ Not in a Stardust DSP project directory'));
        console.log(chalk.yellow('Run this command from your project root'));
        process.exit(1);
      }

      // Firebase initialization
      if (!options.skipFirebase) {
        const { initFirebase } = await inquirer.prompt([{
          type: 'confirm',
          name: 'initFirebase',
          message: 'Initialize Firebase project?',
          default: true
        }]);

        if (initFirebase) {
          const spinner = ora('Initializing Firebase...').start();
          
          try {
            // Run firebase init
            await execa('firebase', ['init', 'firestore', 'functions', 'hosting', 'storage'], {
              stdio: 'inherit',
              cwd: process.cwd()
            });
            spinner.succeed('Firebase initialized');
          } catch (error) {
            spinner.fail('Firebase initialization failed');
            console.log(chalk.yellow('Please run: firebase init manually'));
          }
        }
      }

      // Configure environment variables
      const { configure } = await inquirer.prompt([{
        type: 'confirm',
        name: 'configure',
        message: 'Configure environment variables?',
        default: true
      }]);

      if (configure) {
        const config = await inquirer.prompt([
          {
            type: 'input',
            name: 'firebaseApiKey',
            message: 'Firebase API Key:',
            default: 'your-api-key'
          },
          {
            type: 'input',
            name: 'firebaseAuthDomain',
            message: 'Firebase Auth Domain:',
            default: 'your-project.firebaseapp.com'
          },
          {
            type: 'input',
            name: 'firebaseProjectId',
            message: 'Firebase Project ID:',
            default: 'your-project-id'
          },
          {
            type: 'input',
            name: 'firebaseStorageBucket',
            message: 'Firebase Storage Bucket:',
            default: 'your-project.appspot.com'
          }
        ]);

        // Update .env file
        const envPath = path.join(process.cwd(), '.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        
        // Update or add each config value
        Object.entries(config).forEach(([key, value]) => {
          const envKey = `VITE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
          const regex = new RegExp(`^${envKey}=.*$`, 'm');
          
          if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${envKey}=${value}`);
          } else {
            envContent += `\n${envKey}=${value}`;
          }
        });

        fs.writeFileSync(envPath, envContent.trim());
        console.log(chalk.green('✅ Environment variables configured'));
      }

      // Install dependencies
      const { installDeps } = await inquirer.prompt([{
        type: 'confirm',
        name: 'installDeps',
        message: 'Install/update dependencies?',
        default: false
      }]);

      if (installDeps) {
        const spinner = ora('Installing dependencies...').start();
        await execa('npm', ['install'], { cwd: process.cwd() });
        spinner.succeed('Dependencies installed');
      }

      console.log(chalk.green.bold('\n✨ Initialization complete!'));
      console.log(chalk.cyan('\nNext steps:'));
      console.log('  1. Update .env with your Firebase credentials');
      console.log('  2. Run: npm run dev');
      console.log('  3. Visit: http://localhost:5173');

    } catch (error) {
      console.error(chalk.red('Initialization failed:'), error.message);
      process.exit(1);
    }
  });