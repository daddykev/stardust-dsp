import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import validateProjectName from 'validate-npm-package-name';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const createCommand = new Command('create')
  .argument('<project-name>', 'Name of your DSP project')
  .option('-t, --template <type>', 'Project template', 'streaming')
  .option('-s, --search <provider>', 'Search provider (algolia|typesense|firebase)', 'firebase')
  .option('-c, --cdn <provider>', 'CDN provider (firebase|cloudflare)', 'firebase')
  .option('--skip-install', 'Skip npm installation')
  .option('--skip-git', 'Skip git initialization')
  .description('Create a new Stardust DSP project')
  .action(async (projectName, options) => {
    console.log(chalk.cyan('\n🚀 Creating your Stardust DSP project...\n'));

    // Validate project name
    const validation = validateProjectName(projectName);
    if (!validation.validForNewPackages) {
      console.error(chalk.red(`Invalid project name: ${projectName}`));
      validation.errors?.forEach(err => console.error(chalk.red(`  - ${err}`)));
      validation.warnings?.forEach(warn => console.warn(chalk.yellow(`  - ${warn}`)));
      process.exit(1);
    }

    const targetDir = path.resolve(process.cwd(), projectName);
    
    // Check if directory exists
    if (fs.existsSync(targetDir)) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: `Directory ${chalk.yellow(projectName)} already exists. Overwrite?`,
        default: false
      }]);
      
      if (!overwrite) {
        console.log(chalk.yellow('Operation cancelled'));
        process.exit(0);
      }
      
      const removeSpinner = ora('Removing existing directory...').start();
      await fs.remove(targetDir);
      removeSpinner.succeed();
    }

    // Interactive configuration
    console.log(chalk.cyan('Configure your DSP:\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Select your DSP template:',
        choices: [
          { name: '🎵 Full Streaming Platform (B2C)', value: 'streaming' },
          { name: '📚 Catalog-Only (B2B)', value: 'catalog' },
          { name: '🧪 Test Environment', value: 'test' }
        ],
        default: options.template
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to include:',
        choices: [
          { name: 'User Authentication', value: 'auth', checked: true },
          { name: 'Music Catalog', value: 'catalog', checked: true },
          { name: 'Streaming Player', value: 'player', checked: true },
          { name: 'Search & Discovery', value: 'search', checked: true },
          { name: 'Playlists', value: 'playlists', checked: true },
          { name: 'Analytics Dashboard', value: 'analytics', checked: true },
          { name: 'DSR Reporting', value: 'dsr', checked: true },
          { name: 'Admin Panel', value: 'admin', checked: true },
          { name: 'Offline Support (PWA)', value: 'offline', checked: false },
          { name: 'DRM Protection', value: 'drm', checked: false },
          { name: 'Podcasts', value: 'podcasts', checked: false },
          { name: 'Live Radio', value: 'radio', checked: false }
        ],
        type: 'checkbox'
      },
      {
        type: 'input',
        name: 'organizationName',
        message: 'Your organization/platform name:',
        default: projectName.charAt(0).toUpperCase() + projectName.slice(1).replace(/-/g, ' ')
      },
      {
        type: 'input',
        name: 'adminEmail',
        message: 'Admin email address:',
        validate: (email) => {
          const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return re.test(email) || 'Please enter a valid email';
        }
      },
      {
        type: 'list',
        name: 'authMode',
        message: 'Authentication mode:',
        choices: [
          { name: 'Simple (single user type)', value: 'simple' },
          { name: 'Dual (industry + consumers)', value: 'dual' }
        ],
        default: 'simple',
        when: (answers) => answers.features.includes('auth')
      }
    ]);

    // Create project
    const spinner = ora('Creating project structure...').start();
    
    try {
      // Find template directory (go up two levels from commands folder)
      const templatePath = join(__dirname, '..', '..', 'template');
      
      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        spinner.fail();
        console.error(chalk.red(`Template directory not found at: ${templatePath}`));
        console.error(chalk.yellow('Make sure you have the template folder at the project root'));
        process.exit(1);
      }
      
      // Copy template to target directory
      await fs.copy(templatePath, targetDir, {
        filter: (src) => {
          // Skip node_modules and other build artifacts
          const basename = path.basename(src);
          return !['node_modules', '.git', 'dist', '.firebase'].includes(basename);
        }
      });
      
      spinner.succeed('Project structure created');
      
      // Generate package.json
      const packageSpinner = ora('Generating package.json...').start();
      
      const packageJson = {
        name: projectName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          deploy: 'npm run build && firebase deploy',
          'deploy:functions': 'firebase deploy --only functions',
          'deploy:hosting': 'firebase deploy --only hosting',
          'deploy:rules': 'firebase deploy --only firestore:rules,storage:rules',
          emulators: 'firebase emulators:start',
          'emulators:export': 'firebase emulators:export ./emulator-data',
          'seed:demo': 'node scripts/seed.js',
          test: 'vitest',
          'test:ui': 'vitest --ui',
          lint: 'eslint src --ext .vue,.js,.jsx,.cjs,.mjs --fix --ignore-path .gitignore'
        },
        dependencies: {
          'vue': '^3.4.15',
          'vue-router': '^4.2.5',
          'pinia': '^2.1.7',
          'firebase': '^10.7.1',
          '@vueuse/core': '^10.7.1',
          '@fortawesome/fontawesome-svg-core': '^6.5.1',
          '@fortawesome/free-solid-svg-icons': '^6.5.1',
          '@fortawesome/free-brands-svg-icons': '^6.5.1',
          '@fortawesome/vue-fontawesome': '^3.0.5',
          'axios': '^1.6.2',
          'dayjs': '^1.11.10'
        },
        devDependencies: {
          '@vitejs/plugin-vue': '^5.0.2',
          'vite': '^5.0.10',
          'vitest': '^1.1.3',
          'firebase-tools': '^13.0.2',
          '@vue/test-utils': '^2.4.3',
          'eslint': '^8.56.0',
          'eslint-plugin-vue': '^9.19.2'
        }
      };
      
      // Add feature-specific dependencies
      if (answers.features.includes('search')) {
        if (options.search === 'algolia') {
          packageJson.dependencies['algoliasearch'] = '^4.20.0';
          packageJson.dependencies['vue-instantsearch'] = '^4.13.5';
        } else if (options.search === 'typesense') {
          packageJson.dependencies['typesense'] = '^1.7.2';
          packageJson.dependencies['typesense-instantsearch-adapter'] = '^2.7.1';
        }
      }
      
      if (answers.features.includes('player')) {
        packageJson.dependencies['howler'] = '^2.2.4';
        packageJson.dependencies['wavesurfer.js'] = '^7.5.2';
      }
      
      if (answers.features.includes('drm')) {
        packageJson.dependencies['shaka-player'] = '^4.7.6';
      }
      
      if (answers.features.includes('offline')) {
        packageJson.dependencies['workbox-precaching'] = '^7.0.0';
        packageJson.dependencies['workbox-routing'] = '^7.0.0';
        packageJson.devDependencies['vite-plugin-pwa'] = '^0.17.4';
      }
      
      await fs.writeJson(
        path.join(targetDir, 'package.json'),
        packageJson,
        { spaces: 2 }
      );
      
      packageSpinner.succeed('package.json generated');
      
      // Generate .env file
      const envSpinner = ora('Creating environment configuration...').start();
      
      const envContent = `# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=${projectName}.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=${projectName}
VITE_FIREBASE_STORAGE_BUCKET=${projectName}.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Feature Flags
VITE_USE_FIREBASE_EMULATORS=false
VITE_ENABLE_DRM=${answers.features.includes('drm')}
VITE_ENABLE_OFFLINE=${answers.features.includes('offline')}
VITE_AUTH_MODE=${answers.authMode || 'simple'}

# Search Configuration
VITE_SEARCH_PROVIDER=${options.search}
${options.search === 'algolia' ? `VITE_ALGOLIA_APP_ID=your-algolia-app-id
VITE_ALGOLIA_API_KEY=your-algolia-search-api-key
VITE_ALGOLIA_ADMIN_KEY=your-algolia-admin-api-key` : ''}
${options.search === 'typesense' ? `VITE_TYPESENSE_HOST=localhost
VITE_TYPESENSE_PORT=8108
VITE_TYPESENSE_API_KEY=your-typesense-api-key` : ''}

# Admin Configuration
VITE_ADMIN_EMAIL=${answers.adminEmail}
VITE_ORGANIZATION_NAME=${answers.organizationName}

# DDEX Configuration
VITE_WORKBENCH_API=https://api.ddex-workbench.org
WORKBENCH_API_KEY=your-workbench-api-key

# CDN Configuration
VITE_CDN_PROVIDER=${options.cdn}
${options.cdn === 'cloudflare' ? `VITE_CLOUDFLARE_ACCOUNT_ID=your-account-id
VITE_CLOUDFLARE_API_TOKEN=your-api-token` : ''}`;
      
      await fs.writeFile(path.join(targetDir, '.env.example'), envContent);
      await fs.writeFile(path.join(targetDir, '.env'), envContent);
      await fs.writeFile(path.join(targetDir, '.env.local'), envContent);
      
      envSpinner.succeed('Environment files created');
      
      // Generate configuration file
      const configSpinner = ora('Generating DSP configuration...').start();
      
      // Create config directory if it doesn't exist
      await fs.ensureDir(path.join(targetDir, 'src', 'config'));
      
      const configContent = `// DSP Configuration
export default {
  brand: {
    name: '${answers.organizationName}',
    tagline: 'Your Music, Your Way',
    logo: '/logo.svg',
    favicon: '/favicon.ico',
    primaryColor: '#667eea',
    secondaryColor: '#764ba2'
  },
  
  features: {
    auth: ${answers.features.includes('auth')},
    catalog: ${answers.features.includes('catalog')},
    player: ${answers.features.includes('player')},
    search: ${answers.features.includes('search')},
    playlists: ${answers.features.includes('playlists')},
    analytics: ${answers.features.includes('analytics')},
    dsr: ${answers.features.includes('dsr')},
    admin: ${answers.features.includes('admin')},
    offline: ${answers.features.includes('offline')},
    drm: ${answers.features.includes('drm')},
    podcasts: ${answers.features.includes('podcasts')},
    radio: ${answers.features.includes('radio')}
  },
  
  theme: {
    mode: 'auto', // 'light', 'dark', or 'auto'
    customColors: false
  },
  
  streaming: {
    audioQuality: {
      low: 128,
      medium: 256,
      high: 320
    },
    adaptiveBitrate: true,
    preloadStrategy: 'metadata',
    crossfade: false,
    gapless: true
  },
  
  search: {
    provider: '${options.search}',
    debounceMs: 300,
    minQueryLength: 2,
    fuzzySearch: true
  },
  
  ingestion: {
    autoProcess: true,
    validateWithWorkbench: true,
    supportedVersions: ['3.8.2', '4.3'],
    maxFileSize: '500MB'
  },
  
  monetization: {
    model: 'freemium', // 'free', 'subscription', 'freemium'
    tiers: [
      { id: 'free', name: 'Free', price: 0, features: ['ads', 'shuffle'] },
      { id: 'premium', name: 'Premium', price: 9.99, features: ['no-ads', 'offline', 'hq'] }
    ]
  }
};`;
      
      await fs.writeFile(
        path.join(targetDir, 'src', 'config', 'dsp.config.js'),
        configContent
      );
      
      configSpinner.succeed('Configuration generated');
      
      // Create .gitignore
      const gitignoreContent = `# Dependencies
node_modules
.pnp
.pnp.js

# Build outputs
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Environment files
.env
.env.local
.env.*.local

# Firebase
.firebase
firebase-debug.log
firestore-debug.log
ui-debug.log
emulator-data

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Tests
coverage
*.lcov
.nyc_output

# Misc
.eslintcache
.cache
*.tsbuildinfo`;

      await fs.writeFile(path.join(targetDir, '.gitignore'), gitignoreContent);
      
      // Initialize git repository
      if (!options.skipGit) {
        const gitSpinner = ora('Initializing git repository...').start();
        try {
          await execa('git', ['init'], { cwd: targetDir });
          await execa('git', ['add', '.'], { cwd: targetDir });
          await execa('git', ['commit', '-m', 'Initial commit from Stardust DSP'], { cwd: targetDir });
          gitSpinner.succeed('Git repository initialized');
        } catch (error) {
          gitSpinner.warn('Git initialization skipped (git not available)');
        }
      }
      
      // Install dependencies
      if (!options.skipInstall) {
        const installSpinner = ora('Installing dependencies (this may take a few minutes)...').start();
        
        try {
          // Check if npm is available
          await execa('npm', ['--version']);
          await execa('npm', ['install'], { 
            cwd: targetDir,
            stdio: 'pipe' 
          });
          installSpinner.succeed('Dependencies installed');
        } catch (error) {
          installSpinner.warn('Could not install dependencies automatically');
          console.log(chalk.yellow('  Run "npm install" manually in your project directory'));
        }
      }
      
      // Success message
      console.log(`
${chalk.green.bold('✨ Success!')} Created ${chalk.cyan(projectName)} at ${chalk.gray(targetDir)}

${chalk.cyan('Your DSP project is ready with:')}
  ${answers.features.map(f => chalk.gray('✓ ') + f).join('\n  ')}

${chalk.cyan('Next steps:')}
  ${chalk.gray('1.')} cd ${chalk.white(projectName)}
  ${options.skipInstall ? chalk.gray('2.') + ' npm install' + '\n  ' + chalk.gray('3.') : chalk.gray('2.')} ${chalk.white('npm run dev')}

${chalk.cyan('Configure Firebase:')}
  ${chalk.gray('•')} stardust-dsp init ${chalk.gray('# Initialize Firebase project')}
  ${chalk.gray('•')} Update ${chalk.white('.env')} with your Firebase credentials
  ${chalk.gray('•')} stardust-dsp deploy ${chalk.gray('# Deploy to production')}

${chalk.cyan('Useful commands:')}
  ${chalk.gray('•')} npm run dev ${chalk.gray('# Start development server')}
  ${chalk.gray('•')} npm run emulators ${chalk.gray('# Start Firebase emulators')}
  ${chalk.gray('•')} npm run build ${chalk.gray('# Build for production')}
  ${chalk.gray('•')} stardust-dsp config ${chalk.gray('# Configure DSP settings')}
  ${chalk.gray('•')} stardust-dsp deliveries test ${chalk.gray('# Send test delivery')}

${chalk.yellow('Documentation:')} ${chalk.blue.underline('https://docs.stardust-dsp.org')}
${chalk.yellow('Support:')} ${chalk.blue.underline('https://github.com/stardust-ecosystem/dsp')}

${chalk.magenta.bold('🎵 Happy streaming!')}
      `);
      
    } catch (error) {
      spinner.fail('Failed to create project');
      console.error(chalk.red('\nError details:'));
      console.error(chalk.red(error.message));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      
      // Clean up on failure
      if (fs.existsSync(targetDir)) {
        console.log(chalk.yellow('\nCleaning up...'));
        await fs.remove(targetDir);
      }
      
      process.exit(1);
    }
  });