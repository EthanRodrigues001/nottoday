// One-off: point every `Text` and `TextInput` import at the app's font-aware wrappers.
const fs = require('fs');
const path = require('path');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

const skip = new Set(['text.tsx', 'text-input.tsx', 'gradient-ascii-dom.tsx']);
for (const file of walk(path.join(__dirname, '..', 'src'))) {
  if (skip.has(path.basename(file))) continue;
  let s = fs.readFileSync(file, 'utf8');
  const m = s.match(/import \{([^}]*)\} from 'react-native';\n/);
  if (!m) continue;
  const names = m[1].split(',').map((n) => n.trim()).filter(Boolean);
  const wantsText = names.includes('Text');
  const wantsInput = names.includes('TextInput');
  if (!wantsText && !wantsInput) continue;
  const kept = names.filter((n) => n !== 'Text' && n !== 'TextInput');
  let replacement = kept.length ? `import { ${kept.join(', ')} } from 'react-native';\n` : '';
  if (wantsText) replacement += "import { Text } from '@/components/text';\n";
  if (wantsInput) replacement += "import { TextInput } from '@/components/text-input';\n";
  s = s.replace(m[0], replacement);
  fs.writeFileSync(file, s);
  console.log('updated', path.relative(process.cwd(), file));
}
