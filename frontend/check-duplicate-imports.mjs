import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function findFiles(dir, pattern) {
  let results = [];
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        results = results.concat(findFiles(filePath, pattern));
      }
    } else if (file.match(pattern)) {
      results.push(filePath);
    }
  }

  return results;
}

function checkDuplicates(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // Match multi-line import statements
  const importRegex = /import\s+{([^}]+)}\s+from\s+["'][^"']+["'];?/g;
  const matches = [...content.matchAll(importRegex)];

  for (const match of matches) {
    const fullMatch = match[0];
    const importsStr = match[1];

    const imports = importsStr
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const seen = new Set();
    const duplicates = [];

    for (const imp of imports) {
      if (seen.has(imp)) {
        duplicates.push(imp);
      }
      seen.add(imp);
    }

    if (duplicates.length > 0) {
      console.log(`${filePath}`);
      console.log(`  Duplicates: ${duplicates.join(', ')}`);
      console.log(`  Import: ${fullMatch.replace(/\n/g, ' ').replace(/\s+/g, ' ')}`);
      console.log('');
    }
  }
}

const files = findFiles('./src', /\.(ts|tsx)$/);
console.log(`Checking ${files.length} files for duplicate imports...\n`);

files.forEach(checkDuplicates);

console.log('Done!');
