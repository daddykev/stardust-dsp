import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';

export const deployCommand = new Command('deploy')
  .description('Deploy your DSP to production')
  .option('--only <targets>', 'Deploy only specific targets (hosting,functions,firestore)')
  .option('--skip-build', 'Skip building the frontend')
  .action(async (options) => {
    console.log(chalk.cyan('🚀 Deploying your Stardust DSP...\n'));

    try {
      // Check if we're in a DSP project
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        console.error(chalk.red('❌ Not in a Stardust DSP project directory'));
        process.exit(1);
      }

      // Build frontend
      if (!options.skipBuild) {
        const buildSpinner = ora('Building frontend...').start();
        try {
          await execa('npm', ['run', 'build'], { cwd: process.cwd() });
          buildSpinner.succeed('Frontend built successfully');
        } catch (error) {
          buildSpinner.fail('Build failed');
          throw error;
        }
      }

      // Deploy to Firebase
      const deploySpinner = ora('Deploying to Firebase...').start();
      
      try {
        const args = ['deploy'];
        if (options.only) {
          args.push('--only', options.only);
        }
        
        await execa('firebase', args, { 
          cwd: process.cwd(),
          stdio: 'inherit'
        });
        
        deploySpinner.succeed('Deployment successful');
      } catch (error) {
        deploySpinner.fail('Deployment failed');
        throw error;
      }

      // Get hosting URL
      try {
        const { stdout } = await execa('firebase', ['hosting:channel:list'], {
          cwd: process.cwd()
        });
        
        console.log(chalk.green.bold('\n✅ Deployment complete!'));
        console.log(chalk.cyan('\nYour DSP is live at:'));
        
        // Parse the URL from firebase output (this is simplified)
        const firebaseJson = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
        const projectId = firebaseJson.hosting?.site || 'your-project';
        console.log(chalk.blue(`  https://${projectId}.web.app`));
        
      } catch (error) {
        console.log(chalk.green.bold('\n✅ Deployment complete!'));
        console.log(chalk.yellow('Check Firebase Console for your hosting URL'));
      }

    } catch (error) {
      console.error(chalk.red('\nDeployment failed:'), error.message);
      process.exit(1);
    }
  });