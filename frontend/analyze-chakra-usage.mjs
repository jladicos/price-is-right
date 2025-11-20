import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import * as chakra from '@chakra-ui/react';

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

function extractChakraImports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const imports = new Set();

  // Match imports from @chakra-ui/react
  const importRegex = /import\s+{([^}]+)}\s+from\s+["']@chakra-ui\/react["'];?/g;
  const matches = [...content.matchAll(importRegex)];

  for (const match of matches) {
    const importsStr = match[1];
    const componentNames = importsStr
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    componentNames.forEach(name => imports.add(name));
  }

  return imports;
}

// Find all TypeScript/TSX files
const files = findFiles('./src', /\.(ts|tsx)$/);

// Collect all unique Chakra components used
const allComponents = new Set();
const fileComponentMap = new Map();

files.forEach(file => {
  const imports = extractChakraImports(file);
  if (imports.size > 0) {
    fileComponentMap.set(file, imports);
    imports.forEach(comp => allComponents.add(comp));
  }
});

console.log('='.repeat(80));
console.log('CHAKRA UI COMPONENT USAGE ANALYSIS');
console.log('='.repeat(80));
console.log();

// Categorize components
const namespaceComponents = [];
const regularComponents = [];
const unknownComponents = [];

[...allComponents].sort().forEach(name => {
  const component = chakra[name];

  if (!component) {
    unknownComponents.push(name);
  } else if (typeof component === 'object' && 'Root' in component) {
    namespaceComponents.push(name);
  } else {
    regularComponents.push(name);
  }
});

console.log(`📊 SUMMARY`);
console.log(`  Total unique components: ${allComponents.size}`);
console.log(`  Namespace components: ${namespaceComponents.length}`);
console.log(`  Regular components: ${regularComponents.length}`);
console.log(`  Unknown/Not found: ${unknownComponents.length}`);
console.log();

if (namespaceComponents.length > 0) {
  console.log('🔷 NAMESPACE COMPONENTS (require .Root, .Image, etc.)');
  namespaceComponents.forEach(name => {
    console.log(`  ✓ ${name}`);
  });
  console.log();
}

if (regularComponents.length > 0) {
  console.log('🔹 REGULAR COMPONENTS');
  regularComponents.forEach(name => {
    console.log(`  ✓ ${name}`);
  });
  console.log();
}

if (unknownComponents.length > 0) {
  console.log('⚠️  UNKNOWN/DEPRECATED COMPONENTS');
  unknownComponents.forEach(name => {
    console.log(`  ⚠️  ${name}`);

    // List files using this component
    fileComponentMap.forEach((imports, file) => {
      if (imports.has(name)) {
        console.log(`      Used in: ${file}`);
      }
    });
  });
  console.log();
}

console.log('='.repeat(80));
console.log('COMPONENT USAGE BY FILE');
console.log('='.repeat(80));
console.log();

[...fileComponentMap.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .forEach(([file, imports]) => {
    console.log(`📄 ${file}`);
    const sortedImports = [...imports].sort();
    sortedImports.forEach(imp => {
      const component = chakra[imp];
      let status = '  ✓';

      if (!component) {
        status = '  ⚠️';
      } else if (typeof component === 'object' && 'Root' in component) {
        status = '  🔷';
      }

      console.log(`${status} ${imp}`);
    });
    console.log();
  });

console.log('='.repeat(80));
console.log('LEGEND');
console.log('='.repeat(80));
console.log('  ✓  = Regular component');
console.log('  🔷 = Namespace component (requires .Root pattern)');
console.log('  ⚠️  = Unknown/deprecated component');
console.log('='.repeat(80));
