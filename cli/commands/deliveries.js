import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import fs from 'fs-extra';
import path from 'path';

export const deliveriesCommand = new Command('deliveries')
  .description('Manage DDEX deliveries')
  .argument('[action]', 'Action to perform (list|process|test)')
  .option('-l, --limit <number>', 'Number of deliveries to show', '10')
  .option('-s, --status <status>', 'Filter by status (pending|processing|completed|failed)')
  .action(async (action = 'list', options) => {
    switch (action) {
      case 'list':
        await listDeliveries(options);
        break;
      case 'process':
        await processDelivery();
        break;
      case 'test':
        await sendTestDelivery();
        break;
      default:
        console.error(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.yellow('Available actions: list, process, test'));
        process.exit(1);
    }
  });

async function listDeliveries(options) {
  console.log(chalk.cyan('📦 Recent Deliveries\n'));
  
  // In production, this would query Firestore
  // For now, show mock data
  const deliveries = [
    {
      id: 'DEL-001',
      sender: 'Universal Music',
      received: '2024-01-15 10:30',
      status: 'completed',
      releases: 12,
      tracks: 156
    },
    {
      id: 'DEL-002',
      sender: 'Indie Records',
      received: '2024-01-15 09:15',
      status: 'processing',
      releases: 3,
      tracks: 38
    },
    {
      id: 'DEL-003',
      sender: 'Test Label',
      received: '2024-01-14 16:45',
      status: 'failed',
      releases: 1,
      tracks: 0,
      error: 'Invalid ERN format'
    }
  ];

  // Create table
  const table = new Table({
    head: ['ID', 'Sender', 'Received', 'Status', 'Releases', 'Tracks'],
    colWidths: [12, 20, 20, 12, 10, 10],
    style: {
      head: ['cyan']
    }
  });

  // Filter by status if provided
  let filtered = deliveries;
  if (options.status) {
    filtered = deliveries.filter(d => d.status === options.status);
  }

  // Add rows to table
  filtered.slice(0, parseInt(options.limit)).forEach(delivery => {
    const statusColor = {
      completed: chalk.green(delivery.status),
      processing: chalk.yellow(delivery.status),
      failed: chalk.red(delivery.status),
      pending: chalk.gray(delivery.status)
    };

    table.push([
      delivery.id,
      delivery.sender,
      delivery.received,
      statusColor[delivery.status] || delivery.status,
      delivery.releases,
      delivery.tracks || '-'
    ]);
  });

  console.log(table.toString());
  
  if (filtered.some(d => d.status === 'failed')) {
    console.log(chalk.yellow('\n⚠️  Some deliveries failed. Run "stardust-dsp deliveries process" to retry'));
  }
}

async function processDelivery() {
  const { deliveryId } = await inquirer.prompt([{
    type: 'input',
    name: 'deliveryId',
    message: 'Enter delivery ID to process (or path to delivery package):',
    validate: (input) => input.length > 0 || 'Please enter a delivery ID or path'
  }]);

  const spinner = ora('Processing delivery...').start();

  try {
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    spinner.succeed('Delivery processed successfully');
    
    console.log(chalk.green('\n✅ Processing complete:'));
    console.log('  • Releases ingested: 5');
    console.log('  • Tracks processed: 67');
    console.log('  • Assets uploaded: 72');
    console.log('  • Acknowledgment sent: Yes');
    
  } catch (error) {
    spinner.fail('Processing failed');
    console.error(chalk.red(error.message));
  }
}

async function sendTestDelivery() {
  console.log(chalk.cyan('🧪 Send Test Delivery\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Select test delivery template:',
      choices: [
        { name: 'Single Track Release', value: 'single' },
        { name: 'Album (10 tracks)', value: 'album' },
        { name: 'Various Artists Compilation', value: 'compilation' },
        { name: 'Invalid ERN (for testing)', value: 'invalid' }
      ]
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'Delivery endpoint:',
      default: 'http://localhost:5001/api/deliveries'
    }
  ]);

  const spinner = ora('Sending test delivery...').start();

  try {
    // Generate test ERN based on template
    const testERN = generateTestERN(answers.template);
    
    // In production, this would actually send to the endpoint
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    spinner.succeed('Test delivery sent');
    
    console.log(chalk.green('\n✅ Delivery sent successfully'));
    console.log(chalk.gray(`  Delivery ID: TEST-${Date.now()}`));
    console.log(chalk.gray(`  Check your ingestion logs for processing status`));
    
  } catch (error) {
    spinner.fail('Failed to send test delivery');
    console.error(chalk.red(error.message));
  }
}

function generateTestERN(template) {
  // Generate test ERN XML based on template
  const templates = {
    single: `<?xml version="1.0" encoding="UTF-8"?>
<ern:ReleaseMessage xmlns:ern="...">
  <!-- Single track release ERN -->
</ern:ReleaseMessage>`,
    album: `<?xml version="1.0" encoding="UTF-8"?>
<ern:ReleaseMessage xmlns:ern="...">
  <!-- Album release ERN -->
</ern:ReleaseMessage>`,
    compilation: `<?xml version="1.0" encoding="UTF-8"?>
<ern:ReleaseMessage xmlns:ern="...">
  <!-- Compilation release ERN -->
</ern:ReleaseMessage>`,
    invalid: `<?xml version="1.0" encoding="UTF-8"?>
<InvalidERN>
  <!-- This will fail validation -->
</InvalidERN>`
  };
  
  return templates[template];
}