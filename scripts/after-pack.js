const fs = require('fs');
const path = require('path');

module.exports = async (context) => {
  const { appOutDir, packager } = context;

  console.log('Running after-pack script...');

  // Ensure backend directory exists in the packaged app
  const backendSource = path.join(packager.info.projectDir, 'backend');
  const backendDest = path.join(appOutDir, 'resources', 'backend');

  if (!fs.existsSync(backendDest)) {
    console.log('Creating backend directory in packaged app...');
    fs.mkdirSync(backendDest, { recursive: true });
  }

  // Copy backend files
  const copyRecursive = (src, dest) => {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      fs.readdirSync(src).forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);

        // Skip certain files/directories
        if (file.startsWith('.') ||
            file === 'logs' ||
            file === 'exports' ||
            file === 'data' ||
            file.endsWith('.log') ||
            file.endsWith('.sqlite') ||
            file.endsWith('.db') ||
            file === 'dmautomation.db') {
          return;
        }

        copyRecursive(srcPath, destPath);
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  };

  try {
    console.log(`Copying backend from ${backendSource} to ${backendDest}`);
    copyRecursive(backendSource, backendDest);
    console.log('Backend files copied successfully');
  } catch (error) {
    console.error('Error copying backend files:', error);
  }

  // Ensure backend node_modules exists
  const backendNodeModulesSrc = path.join(packager.info.projectDir, 'backend', 'node_modules');
  const backendNodeModulesDest = path.join(backendDest, 'node_modules');

  if (fs.existsSync(backendNodeModulesSrc)) {
    try {
      console.log('Copying backend node_modules...');
      copyRecursive(backendNodeModulesSrc, backendNodeModulesDest);
      console.log('Backend node_modules copied successfully');
    } catch (error) {
      console.error('Error copying backend node_modules:', error);
    }
  } else {
    console.warn('Backend node_modules not found, backend may not work properly');
  }

  console.log('After-pack script completed');
};
