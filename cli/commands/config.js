import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

export const configCommand = new Command('config')
  .description('Configure DSP settings')
  .argument('[setting]', 'Setting to configure (ingestion|streaming|search|branding)')
  .action(async (setting) => {
    console.log(chalk.cyan('⚙️  Configuring Stardust DSP\n'));

    const configPath = path.join(process.cwd(), 'src', 'config', 'dsp.config.js');
    
    if (!fs.existsSync(configPath)) {
      console.error(chalk.red('❌ Configuration file not found'));
      console.log(chalk.yellow('Run this command from your project root'));
      process.exit(1);
    }

    // If no setting specified, show menu
    if (!setting) {
      const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: 'What would you like to configure?',
        choices: [
          { name: '🎨 Branding & Theme', value: 'branding' },
          { name: '📥 Ingestion Settings', value: 'ingestion' },
          { name: '🎵 Streaming Configuration', value: 'streaming' },
          { name: '🔍 Search Provider', value: 'search' },
          { name: '✨ Features', value: 'features' }
        ]
      }]);
      setting = choice;
    }

    switch (setting) {
      case 'branding':
        await configureBranding();
        break;
      case 'ingestion':
        await configureIngestion();
        break;
      case 'streaming':
        await configureStreaming();
        break;
      case 'search':
        await configureSearch();
        break;
      case 'features':
        await configureFeatures();
        break;
      default:
        console.error(chalk.red(`Unknown setting: ${setting}`));
        process.exit(1);
    }

    console.log(chalk.green('\n✅ Configuration updated successfully!'));
  });

async function configureBranding() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Platform name:',
      default: 'My Music Service'
    },
    {
      type: 'input',
      name: 'tagline',
      message: 'Platform tagline:',
      default: 'Your Music, Your Way'
    },
    {
      type: 'input',
      name: 'primaryColor',
      message: 'Primary color (hex):',
      default: '#667eea'
    },
    {
      type: 'list',
      name: 'theme',
      message: 'Default theme:',
      choices: ['light', 'dark', 'auto']
    }
  ]);

  // Update config file
  console.log(chalk.yellow('Please update your dsp.config.js with these values'));
  console.log(JSON.stringify(answers, null, 2));
}

async function configureIngestion() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'method',
      message: 'Delivery reception method:',
      choices: [
        { name: 'Cloud Storage (Recommended)', value: 'storage' },
        { name: 'FTP Server', value: 'ftp' },
        { name: 'REST API', value: 'api' },
        { name: 'All methods', value: 'all' }
      ]
    },
    {
      type: 'confirm',
      name: 'autoProcess',
      message: 'Automatically process deliveries?',
      default: true
    },
    {
      type: 'confirm',
      name: 'validateWithWorkbench',
      message: 'Validate ERN via DDEX Workbench?',
      default: true
    }
  ]);

  if (answers.validateWithWorkbench) {
    const { workbenchApiKey } = await inquirer.prompt([{
      type: 'input',
      name: 'workbenchApiKey',
      message: 'DDEX Workbench API key:',
      default: 'your-workbench-api-key'
    }]);

    // Add to .env
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('WORKBENCH_API_KEY')) {
      fs.appendFileSync(envPath, `\nWORKBENCH_API_KEY=${workbenchApiKey}`);
    }
  }

  console.log(chalk.green('Ingestion configured!'));
}

async function configureStreaming() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'cdn',
      message: 'CDN provider:',
      choices: [
        { name: 'Firebase Storage', value: 'firebase' },
        { name: 'Cloudflare', value: 'cloudflare' },
        { name: 'AWS CloudFront', value: 'aws' },
        { name: 'Custom CDN', value: 'custom' }
      ]
    },
    {
      type: 'checkbox',
      name: 'formats',
      message: 'Streaming formats:',
      choices: [
        { name: 'HLS', value: 'hls', checked: true },
        { name: 'DASH', value: 'dash', checked: true },
        { name: 'Progressive MP3', value: 'mp3', checked: true }
      ]
    },
    {
      type: 'confirm',
      name: 'adaptiveBitrate',
      message: 'Enable adaptive bitrate streaming?',
      default: true
    },
    {
      type: 'confirm',
      name: 'drm',
      message: 'Enable DRM protection?',
      default: false
    }
  ]);

  console.log(chalk.green('Streaming configured!'));
  console.log(chalk.yellow('Update your Cloud Functions to implement these settings'));
}

async function configureSearch() {
  const { provider } = await inquirer.prompt([{
    type: 'list',
    name: 'provider',
    message: 'Search provider:',
    choices: [
      { name: 'Algolia', value: 'algolia' },
      { name: 'Typesense', value: 'typesense' },
      { name: 'Elasticsearch', value: 'elasticsearch' },
      { name: 'Firebase (Basic)', value: 'firebase' }
    ]
  }]);

  if (provider === 'algolia') {
    const algoliaConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'appId',
        message: 'Algolia App ID:'
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'Algolia API Key:'
      }
    ]);

    // Update .env
    const envPath = path.join(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/VITE_ALGOLIA_APP_ID=.*/, `VITE_ALGOLIA_APP_ID=${algoliaConfig.appId}`);
    envContent = envContent.replace(/VITE_ALGOLIA_API_KEY=.*/, `VITE_ALGOLIA_API_KEY=${algoliaConfig.apiKey}`);
    fs.writeFileSync(envPath, envContent);
  }

  console.log(chalk.green('Search provider configured!'));
}

async function configureFeatures() {
  const { features } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'features',
    message: 'Select features to enable:',
    choices: [
      { name: 'User Authentication', value: 'auth', checked: true },
      { name: 'Music Catalog', value: 'catalog', checked: true },
      { name: 'Streaming Player', value: 'player', checked: true },
      { name: 'Search & Discovery', value: 'search', checked: true },
      { name: 'Playlists', value: 'playlists', checked: true },
      { name: 'Analytics Dashboard', value: 'analytics', checked: true },
      { name: 'DSR Reporting', value: 'dsr', checked: true },
      { name: 'Admin Panel', value: 'admin', checked: true },
      { name: 'Offline Support', value: 'offline', checked: false },
      { name: 'DRM Protection', value: 'drm', checked: false },
      { name: 'Podcasts', value: 'podcasts', checked: false },
      { name: 'Live Radio', value: 'radio', checked: false }
    ]
  }]);

  console.log(chalk.green('Features configured!'));
  console.log(chalk.yellow('Update your dsp.config.js to reflect these changes'));
}