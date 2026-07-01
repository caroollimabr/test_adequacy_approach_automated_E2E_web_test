#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { createContractEndpoints, parseContract, convertOpenApiPathToRegex } from './contract-coverage/endpoint-reader.js';
import { findHarFiles, mapAccessedEndpointsPerFeaturePerTest } from './contract-coverage/har-reader.js'
import { generateCoverageContent, generateHTMLReport } from './contract-coverage/report-generator.js';

export async function run() {

  console.log(chalk.blue.bold('\nWelcome to Contract Coverage Evaluator!\n'));

  //CAPTURE CMD ARGS
  const args = process.argv.slice(2);
  let openapiPath = './openapi/openapi.json'; 
  let harDir = './logs';     

  args.forEach(arg => {
    if (arg.startsWith('--openapi=')) openapiPath = arg.split('=')[1];
    if (arg.startsWith('--har=')) harDir = arg.split('=')[1];
  });

  if (!fs.existsSync(openapiPath)) {
    console.log(chalk.red(`OpenAPI file not found on "${openapiPath}".`));
    process.exit(1);
  }
  
  //READ CONTRACT + HAR FILES
  console.log(chalk.yellow('Reading OpenAPI contract and extracting paths...'));
  
  let openapiData = parseContract(openapiPath);

  console.log(chalk.yellow(`\nChecking for HAR files on "${harDir}"...`));
  const harFiles = findHarFiles(path.resolve(harDir));
  
  if (harFiles.length === 0) {
    console.log(chalk.red(`HAR files not found on "${harDir}".`));
    console.log(chalk.yellow('Make sure that your tests are configured to generate HAR files.'));
    process.exit(1);
  }

  let contractEndpoints = createContractEndpoints(openapiData);

  let accessedEndpointsMap = mapAccessedEndpointsPerFeaturePerTest(harFiles, harDir);
  
//GENERATE REPORT
const { 
    coveredEndpoints, 
    undocumentedEndpoints, 
    missedEndpoints, 
    coveragePercentage 
  } = generateCoverageContent(contractEndpoints, accessedEndpointsMap);



  const outputDir = './concov_report';
  fs.ensureDirSync(path.resolve(outputDir));
  
  const htmlContent = generateHTMLReport(
    coveragePercentage, 
    coveredEndpoints, 
    missedEndpoints, 
    undocumentedEndpoints
  );
  
  const reportPath = path.join(path.resolve(outputDir), 'report.html');
  fs.writeFileSync(reportPath, htmlContent);

  console.log(chalk.green.bold(`\nReport generated on ${reportPath}`));

}

//run().catch(err => console.error(chalk.red(err)));

