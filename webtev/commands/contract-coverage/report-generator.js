export function generateCoverageContent(contractEndpoints, accessedEndpointsMap) {
  const coveredEndpointsMap = new Map();
  const undocumentedEndpoints = [];
  const coveredContractKeys = new Set();

  for (const [accessedKey, usageMap] of accessedEndpointsMap.entries()) {
    const [method, pathname] = accessedKey.split(' ');
    
    const matchingContract = contractEndpoints.find(endpoint => 
      endpoint.method === method && endpoint.regex.test(pathname)
    );

    if (!matchingContract) {
      undocumentedEndpoints.push({ endpointKey: accessedKey, usage: usageMap });
      continue;
    }

    const { originalKey } = matchingContract;
    coveredContractKeys.add(originalKey);
    
    if (!coveredEndpointsMap.has(originalKey)) {
      coveredEndpointsMap.set(originalKey, { originalKey, usage: new Map() });
    }
    const currentCovered = coveredEndpointsMap.get(originalKey);

    for (const [fName, testsMap] of usageMap.entries()) {
      if (!currentCovered.usage.has(fName)) currentCovered.usage.set(fName, new Map());
      const targetTestsMap = currentCovered.usage.get(fName);
      
      for (const [tName, count] of testsMap.entries()) {
        targetTestsMap.set(tName, (targetTestsMap.get(tName) || 0) + count);
      }
    }
  }

  const coveredEndpoints = Array.from(coveredEndpointsMap.values());
  const missedEndpoints = contractEndpoints
    .filter(endpoint => !coveredContractKeys.has(endpoint.originalKey))
    .map(endpoint => endpoint.originalKey);

  const totalContract = contractEndpoints.length;
  const coveragePercentage = totalContract > 0 
    ? ((coveredEndpoints.length / totalContract) * 100).toFixed(2) 
    : "0.00";

  return {
    coveredEndpoints,
    undocumentedEndpoints,
    missedEndpoints,
    coveragePercentage
  };
}

export function generateHTMLReport(percentage, covered, missed, undocumented) {
  return `
<!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Contract Coverage Evaluator</title>
    <style>
      body { font-family: sans-serif; margin: 40px; background: #f4f6f9; color: #333; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }
        h1 { color: #2c3e50; }
        .percentage { font-size: 48px; font-weight: bold; color: #2ecc71; }
        ul { list-style: none; padding: 0; }
        .main-li { padding: 12px; margin: 10px 0; border-radius: 4px; font-family: monospace; font-size: 16px; }
        .missed { background: #fde8e8; color: #9b1c1c; border-left: 5px solid #e11d48; }
        .undocumented { background: #fef9c3; color: #713f12; border-left: 5px solid #ca8a04; }
        .covered { background: #def7ec; color: #03543f; border-left: 5px solid #16a34a; }
        .usage-list { margin-top: 10px; border-radius: 6px; }
        .feature-group { margin-top: 8px; background: rgba(255,255,255,0.7); border-radius: 6px; padding: 10px; border: 1px solid #cbd5e1; }
        .feature-title { font-weight: bold; color: #0369a1; font-size: 14px; display: block; margin-bottom: 8px; font-family: sans-serif; }
        .test-list { padding-left: 12px; border-left: 2px solid #94a3b8; margin-left: 4px; }
        .test-list li { font-size: 14px; color: #4b5563; padding: 4px 0; border-bottom: 1px dashed #cbd5e1; }
        .test-list li:last-child { border-bottom: none; }
        .badge { display: inline-block; background: #e2e8f0; color: #1e293b; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 8px; float: right;}
    </style>
  </head>
  <body>
    <h1>Contract Coverage Evaluator</h1>
    <div class="card">
      <h2>Contract Coverage Percentage</h2>
      <div class="percentage">${percentage}%</div>
      <p>From the total of ${covered.length + missed.length} documented endpoints, ${covered.length} were accessed through the tests.</p>
    </div>

    <div class="card">
      <h2 style="color: #e11d48;">Unaccessed endpoints (${missed.length})</h2>
      <ul>${missed.map(r => `<li class="main-li missed">${r}</li>`).join('')}</ul>
    </div>

    <div class="card">
      <h2 style="color: #ca8a04;">Undocumented endpoints (${undocumented.length})</h2>
      <ul>
        ${undocumented.map(r => `
          <li class="main-li undocumented">
            <strong>${r.endpointKey}</strong>
            <ul class="usage-list">
              ${Array.from(r.usage.entries()).map(([feature, testsMap]) => `
                <li class="feature-group">
                  <span class="feature-title">Feature: ${feature}</span>
                  <ul class="test-list">
                    ${Array.from(testsMap.entries()).map(([test, count]) => `<li>📄 ${test} <span class="badge">${count} accesses</span></li>`).join('')}
                  </ul>
                </li>
              `).join('')}
            </ul>
          </li>
        `).join('')}
      </ul>
    </div>

    <div class="card">
      <h2 style="color: #16a34a;">Covered endpoints (${covered.length})</h2>
      <ul>
        ${covered.map(r => `
          <li class="main-li covered">
            <strong>${r.originalKey}</strong>
            <ul class="usage-list">
              ${Array.from(r.usage.entries()).map(([feature, testsMap]) => `
                <li class="feature-group">
                  <span class="feature-title">Feature: ${feature}</span>
                  <ul class="test-list">
                    ${Array.from(testsMap.entries()).map(([test, count]) => `<li>📄 ${test} <span class="badge">${count} accesses</span></li>`).join('')}
                  </ul>
                </li>
              `).join('')}
            </ul>
          </li>
        `).join('')}
      </ul>
    </div>
  </body>
  </html>
  `;
}