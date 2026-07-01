#!/usr/bin/env node

import chalk from 'chalk';
import { run as runConcov } from './commands/contract-coverage-index.js';
import { run as runReqcov } from './commands/repeatable-req-index.js';

async function main() {
  const command = process.argv[2]; 

  switch (command) {
    case 'concov':
      console.log(chalk.blue.bold('Initializing Contract Coverage Evaluator...'));
      await runConcov();
      break;

    case 'reqcov':
      console.log(chalk.blue.bold('Initializing Repeatable Requirements Coverage Evaluator...'));
      await runReqcov();
      break;

    case '-v':
    case '--version':
      console.log('v1.0.0');
      break;

    default:
      console.log(chalk.red.bold('Invalid command.'));
      console.log('\nCorrect use:');
      console.log(`  webtev ${chalk.green('concov')} --openapi=<openapi_file.json or openapi_file.yaml> --har=<./log_folder>`);
      console.log(`  webtev ${chalk.green('reqcov')} <requirements_file.pdf> <test_folder>`);
      process.exit(1);
  }
}

main().catch(err => console.error(chalk.red(err)));