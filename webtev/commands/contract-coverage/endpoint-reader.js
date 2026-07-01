import fs from 'fs-extra';
import YAML from 'yaml';
import path from 'path';

//PUT /XPTO/{ID}/ABCD/{ID} AS AN ACCESSED ENDPOINT
export function convertOpenApiPathToRegex(openApiPath) {
  let regexStr = openApiPath.replace(/[.+*?^$()|[\]\\]/g, '\\$&');  
  //substituting {id} pattern with [^/]+text
  regexStr = regexStr.replace(/\{[^}]+\}/g, '[^/]+');
  return new RegExp(`^${regexStr}$`);
}


export function createContractEndpoints(openapiData){
  const contractEndpoints = [];
  if (openapiData.paths) {
    for (const [endpoint, methods] of Object.entries(openapiData.paths)) {
      for (const method of Object.keys(methods)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          const upperMethod = method.toUpperCase();
          contractEndpoints.push({
            method: upperMethod,
            originalPath: endpoint,
            originalKey: `${upperMethod} ${endpoint}`,
            regex: convertOpenApiPathToRegex(endpoint)
          });
        }
      }
    }
  }
  return contractEndpoints;
}


export function parseContract(openapiPath){ 
  const fileExt = path.extname(openapiPath).toLowerCase();
  const openapiFile = fs.readFileSync(openapiPath, 'utf8');
  let openapiData;

  try {
    if (fileExt === '.json') {
      openapiData = JSON.parse(openapiFile);
    } else {
      openapiData = YAML.parse(openapiFile);
    }
  } catch (e) {
    console.log(chalk.red(`Error when parsing OpenAPI file: ${e.message}`));
    process.exit(1);
  }
  return openapiData;
}
