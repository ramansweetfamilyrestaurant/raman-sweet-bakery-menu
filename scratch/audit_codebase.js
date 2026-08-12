import fs from 'fs';
import path from 'path';

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.git') && !filePath.includes('dist')) {
      scanDir(filePath, fileList);
    } else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = [...scanDir('c:/menu raman/src'), ...scanDir('c:/menu raman/server')];
console.log(`Scanning ${allFiles.length} files for potential runtime instability risks...`);

let riskCount = 0;
allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    // Risk 1: Unsafe JSON.parse without try-catch on line
    if (line.includes('JSON.parse(') && !line.includes('try') && !line.includes('.catch')) {
      // Check if surrounding lines have try-catch
      const start = Math.max(0, idx - 5);
      const end = Math.min(lines.length - 1, idx + 5);
      const context = lines.slice(start, end).join('\n');
      if (!context.includes('try {')) {
        console.warn(`[UNSAFE JSON.PARSE] ${file}:${idx + 1} -> ${line.trim()}`);
        riskCount++;
      }
    }
  });
});

console.log(`Scan completed. Total potential risks found: ${riskCount}`);
