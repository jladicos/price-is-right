import * as chakra from '@chakra-ui/react';

const componentsToCheck = [
  'Alert',
  'Avatar',
  'Field',
  'Table',
  'Switch',
  'Checkbox',
  'DialogRoot',
  'DialogContent',
  'Toaster',
  'Separator',
  'NativeSelectRoot',
  'createToaster',
  'createSystem'
];

console.log('Chakra UI v3 Component Verification\n');
console.log('='.repeat(60));

componentsToCheck.forEach(name => {
  const component = chakra[name];

  if (!component) {
    console.log(`❌ ${name}: NOT FOUND`);
    return;
  }

  const type = typeof component;
  console.log(`\n✓ ${name} (${type})`);

  if (type === 'object') {
    const keys = Object.keys(component);
    if (keys.includes('Root')) {
      console.log(`  → Namespace component with: ${keys.join(', ')}`);
    } else if (keys.length > 0 && keys.length < 20) {
      console.log(`  → Object with keys: ${keys.slice(0, 10).join(', ')}`);
    }
  } else if (type === 'function') {
    console.log(`  → Function/Component`);
  }
});

console.log('\n' + '='.repeat(60));
