#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import pdf from 'pdf-parse';

const API_KEY = process.env.OPENCODE_API_KEY || 'sk-NFFzXK8Cjm0guxGbmyMY3HaeoeMjkYqz9OoyUbwGgkDgg2CO7ZDsmphMXFPxhaJB'; // 'sk-NFFzXK8Cjm0guxGbmyMY3HaeoeMjkYqz9OoyUbwGgkDgg2CO7ZDsmphMXFPxhaJB'; //'ollama'
const API_URL = process.env.OPENCODE_API_URL || 'https://opencode.ai/zen/v1/chat/completions'; // 'https://opencode.ai/zen/v1/chat/completions'; //'http://localhost:11434/v1/chat/completions';
const MODEL = process.env.OPENCODE_MODEL || 'north-mini-code-free';// 'north-mini-code-free'; //'llama3.2';

export async function callOpencode(systemPrompt, userPrompt) {
    if (!API_KEY) {
        console.error(chalk.red("[ERROR] The environment variable OPENCODE_API_KEY is not defined or is invalid."));
        process.exit(1);
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.1
            })
        });

        const textData = await response.text();
        let data = {};
        try { data = JSON.parse(textData); } catch(e) { data = { raw: textData }; }
        
        if (!response.ok) {
            console.log(chalk.red(`\n[API HTTP STATUS]: ${response.status}`));
            console.log(chalk.red(`[API RESPONSE]: ${JSON.stringify(data, null, 2)}\n`));
            throw new Error(chalk.red(data.error?.message || data.message || textData || '[ERROR] An unknown error occurred in the API'));
        }

        const contentCleaned = data.choices[0].message.content
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
        return JSON.parse(contentCleaned);
    } catch (error) {
        console.error(chalk.red("[ERROR] Failed to communicate with OpenCode:", error.message));
        process.exit(1);
    }
}

export async function getTestFilesList(dirPath) {
    let results = [];
    try {
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);
            if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(file.name)) {
                continue;
            }
            if (file.isDirectory()) {
                results = results.concat(await getTestFilesList(fullPath));
            } else if (file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.spec.js') || file.name.endsWith('.test.js')) {
                results.push({ name: file.name, path: fullPath });
            }
        }
    } catch (error) {
        console.error(chalk.red(`[ERROR] Failed to read directory: ${error.message}`));
        process.exit(1);
    }
    return results;
}

export function parseJsonToCSV(array) {
    if (!array || array.length === 0) return '';
    const headers = Object.keys(array[0]);
    const csvRows = [headers.join(';')];

    for (const row of array) {
        const values = headers.map(header => {
            const val = String(row[header] ?? '');
            const escaped = val.replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(';'));
    }
    return csvRows.join('\n');
}

export function generateHTMLReport(requirements, coverage, aiModel) {
    const totalReqs = coverage.length;
    const coveredItems = coverage.filter(c => c.coveredItem).length;
    const pendingItems = totalReqs - coveredItems;
    const coveragePercentage = totalReqs > 0 ? ((coveredItems / totalReqs) * 100).toFixed(1) : 0;

    let coverageHTMLTable = '';
    coverage.forEach(item => {
        const statusClass = item.coveredItem ? 'status-covered' : 'status-pending';
        const statusText = item.coveredItem ? 'Covered' : 'Pending';
        coverageHTMLTable += `
            <tr>
                <td><strong>${item.id}</strong></td>
                <td>${item.description}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td><code>${item.test_file || '-'}</code></td>
            </tr>
        `;
    });

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Repeatable Requirement Coverage</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; color: #333; margin: 0; padding: 40px; }
            .container { max-width: 1100px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            h1 { color: #1e293b; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
            .meta { font-size: 0.9em; color: #64748b; margin-bottom: 30px; }
            .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
            .card { background: #f8fafc; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center; }
            .card .number { font-size: 2em; font-weight: bold; color: #0f172a; margin-top: 5px; }
            .card.highlight .number { color: #2563eb; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #0f172a; color: white; text-align: left; padding: 12px; font-weight: 600; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
            tr:hover { background-color: #f8fafc; }
            .badge { padding: 6px 12px; border-radius: 20px; font-size: 0.85em; font-weight: bold; display: inline-block; }
            .status-covered { background-color: #dcfce7; color: #15803d; }
            .status-pending { background-color: #fee2e2; color: #b91c1c; }
            code { background: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-family: monospace; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Coverage Report</h1>
            <div class="meta">Generated via Opencode • Model: <strong>${aiModel}</strong> • Date: ${new Date().toLocaleString('en-US')}</div>
            
            <div class="dashboard">
                <div class="card">
                    <div>Total of Repeatable Requirements (regression)</div>
                    <div class="number">${totalReqs}</div>
                </div>
                <div class="card">
                    <div>Covered Items</div>
                    <div class="number" style="color: #16a34a;">${coveredItems}</div>
                </div>
                <div class="card">
                    <div>Pending Items</div>
                    <div class="number" style="color: #dc2626;">${pendingItems}</div>
                </div>
                <div class="card highlight">
                    <div>Coverage Percentage</div>
                    <div class="number">${coveragePercentage}%</div>
                </div>
            </div>

            <h2>Coverage Details</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width: 12%">ID</th>
                        <th style="width: 48%">Repeatable Requirement</th>
                        <th style="width: 15%">Status</th>
                        <th style="width: 25%">Test File</th>
                    </tr>
                </thead>
                <tbody>
                    ${coverageHTMLTable}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    `;
}

export async function run() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log(chalk.red("Use: webtev reqcov <requirements_file.pdf> <test_folder>"));
        process.exit(1);
    }

    const reqFilePath = args[1];
    const testsDirPath = args[2];

    if (!reqFilePath.toLowerCase().endsWith('.pdf')) {
        console.error(chalk.red("[ERROR] The requirements file must be a valid .pdf file"));
        process.exit(1);
    }

    let requirements = [];
    const csvCachePath = 'mapped_requirements.csv';

    if (await fs.pathExists(csvCachePath)) {
        console.log(chalk.green(`\n[CACHE] Found '${csvCachePath}'. Skipping PDF extraction...`));
        try {
            const csvContent = await fs.readFile(csvCachePath, 'utf-8');
            const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const dataLines = lines.slice(1); 
            
            requirements = dataLines.map(line => {
                const parts = line.split(';').map(part => part.replace(/^"|"$/g, '').trim());
                return {
                    id: parts[0] || '',
                    description: parts[1] || ''
                };
            });
            
            console.log(chalk.green(`Successfully loaded ${requirements.length} requirements from local CSV.`));
        } catch (error) {
            console.error(chalk.red(`[ERROR] Failed to read existing CSV cache: ${error.message}.`));
            console.log(chalk.yellow("Proceeding to PDF analysis..."));
            requirements = []; 
        }
    }

    if (requirements.length === 0) {
        console.log(chalk.yellow("Reading requirements file from PDF file..."));
        let requirementsText = "";
        try {
            const dataBuffer = await fs.readFile(reqFilePath);
            const pdfData = await pdf(dataBuffer);
            requirementsText = pdfData.text;
        } catch (error) {
            console.error(chalk.red(`[ERROR] Failed to read requirements file: ${error.message}`));
            process.exit(1);
        }

        console.log(chalk.yellow("Analyzing requirements using OpenCode..."));
        const extractSystemPrompt = `You are an expert QA engineer. Analyze the text extracted from a requirements PDF file and identify all repeatable functional requirements that should be converted into automated E2E regression tests. Maintain the language used in the PDF file.
STRICTLY return a JSON object exactly matching this structural model:
{
  "requirements": [
    { "id": "REQ-01", "description": "Requirement description here" }
  ]
}`;

        const extractedData = await callOpencode(extractSystemPrompt, requirementsText);
        
        const rawRequirements = extractedData.requirements || extractedData.requisitos || [];
        requirements = rawRequirements.map(item => ({
            id: item.id || item.ID || '',
            description: item.description || item.descricao || ''
        }));

        if (requirements.length === 0) {
            console.log(chalk.red("[ERROR] No requirements were extracted. Check if the correct requirements file was referenced."));
            process.exit(0);
        }

        const csvRequirements = parseJsonToCSV(requirements);
        await fs.writeFile(csvCachePath, csvRequirements, 'utf-8');
        console.log(chalk.green("Repeatable requirements successfully exported to 'mapped_requirements.csv'"));
    }

    console.log(chalk.green("\nThe following requirements are being used for cross-referencing:"));
    console.table(requirements);

    console.log(chalk.yellow("\nLocating test files..."));
    const testFiles = await getTestFilesList(testsDirPath);

    if (testFiles.length === 0) {
        console.log(chalk.red("[ERROR] No tests were found"));
        process.exit(1);
    }

    const masterCoverageMap = {};
    requirements.forEach(req => {
        masterCoverageMap[req.id] = {
            id: req.id,
            description: req.description,
            coveredItem: false,
            test_file: null
        };
    });

    console.log(chalk.yellow(`\nVerifying test coverage using OpenCode and ${MODEL} file by file...`));
    
    const coverageSystemPrompt = `You are an expert QA engineer. Cross-reference the provided list of requirements with the source code of ONE SINGLE test file.
Identify which requirement IDs from the list are covered (implemented) in this specific source code.

STRICTLY return a JSON object containing an array of covered IDs found in this file exactly matching this structural model:
{
  "coveredIds": ["REQ-01", "REQ-02"]
}`;

    for (const file of testFiles) {
        console.log(chalk.blue(`-> Analyzing full source code of: ${file.name}`));
        try {
            const fileContent = await fs.readFile(file.path, 'utf-8');
            const userPrompt = `REQUIREMENTS LIST:\n${JSON.stringify(requirements)}\n\nTEST FILE SOURCE CODE (${file.name}):\n${fileContent}`;
            
            const result = await callOpencode(coverageSystemPrompt, userPrompt);
            const foundIds = result.coveredIds || result.ids || [];

            if (foundIds.length === 0) {
                continue; 
            }

            foundIds.forEach(id => {
                const cleanId = String(id).toUpperCase().trim();
                if (masterCoverageMap[cleanId]) {
                    masterCoverageMap[cleanId].coveredItem = true;
                    
                    if (masterCoverageMap[cleanId].test_file) {
                        const existingFiles = masterCoverageMap[cleanId].test_file.split(', ');

                        if (!existingFiles.includes(file.name)) {
                            masterCoverageMap[cleanId].test_file += `, ${file.name}`;
                        }
                    } else {
                        masterCoverageMap[cleanId].test_file = file.name;
                    }
                }
            });

        } catch (error) {
            console.error(chalk.red(`\n[ERROR] Analysis failed while processing file: ${file.name}`));
            console.error(chalk.yellow(`Reason: ${error.message}`));
            process.exit(1);
        }
    }

    const coverage = Object.values(masterCoverageMap);

    if (coverage.length === 0) {
        console.error(chalk.red("\n[ERROR] Final processing failed. No final map could be generated."));
        process.exit(1);
    }

    const finalTable = coverage.map(item => ({
        ID: item.id,
        Description: item.description ? (item.description.substring(0, 50) + "...") : "-",
        Status: item.coveredItem ? "Covered" : "PENDING",
        File: item.test_file || "-"
    }));

    console.log("\nRegression Test Coverage Report (Consolidated):");
    console.table(finalTable);
    
    const csvCoverage = parseJsonToCSV(coverage);
//    await fs.writeFile('coverage_report.csv', csvCoverage, 'utf-8');
//    console.log(chalk.blue("Coverage report successfully exported to 'coverage_report.csv'"));

    console.log(chalk.yellow("\nGenerating HTML report..."));
    const htmlContent = generateHTMLReport(requirements, coverage, MODEL);
    await fs.writeFile('coverage_report.html', htmlContent, 'utf-8');
    console.log(chalk.blue("HTML report successfully generated in 'coverage_report.html'"));

    const pendingItems = coverage.filter(c => !c.coveredItem);
    if (pendingItems.length > 0) {
        console.log(chalk.red(`\nWarning: There is/are ${pendingItems.length} uncovered requirement(s).`));
    } else {
        console.log(chalk.green("\nAll requirements were covered by the automated web tests."));
    }
}

//run();