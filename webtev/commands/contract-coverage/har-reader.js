import fs from 'fs-extra';
import path from 'path';

export function findHarFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findHarFiles(filePath, fileList);
    } else if (filePath.endsWith('.har')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export function mapAccessedEndpointsPerFeaturePerTest(harFiles, harDir){
    const accessedEndpointsMap = new Map();

    harFiles.forEach(file => {
      const relativePath = path.relative(path.resolve(harDir), file);
      const pathParts = relativePath.split(path.sep);
      let featureName;
      if (pathParts[0] === 'logs' && pathParts.length > 1) {
          featureName = pathParts[1]; // Pega a pasta DENTRO de logs
      } else {
          featureName = pathParts.length > 1 ? pathParts[0] : 'General';
      }
    
    
    const testName = pathParts[pathParts.length - 1];

    try {
      const harContent = fs.readJsonSync(file);
      if (harContent.log && harContent.log.entries) {
        harContent.log.entries.forEach(entry => {
          const method = entry.request.method.toUpperCase();
          const fullUrl = entry.request.url;

          try {
            const parsedUrl = new URL(fullUrl);
            if (!parsedUrl.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/i)) {
               const endpointKey = `${method} ${parsedUrl.pathname}`;
               
               if (!accessedEndpointsMap.has(endpointKey)) {
                 accessedEndpointsMap.set(endpointKey, new Map());
               }
               
               const featureMap = accessedEndpointsMap.get(endpointKey);
               if (!featureMap.has(featureName)) {
                 featureMap.set(featureName, new Map());
               }
               
               const testUsage = featureMap.get(featureName);
               testUsage.set(testName, (testUsage.get(testName) || 0) + 1);
            }
          } catch(e) {}
        });
      }
    } catch (err) {}
  });
  return accessedEndpointsMap;
}