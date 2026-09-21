import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function logSelectorDiagnostics(runtimeDir) {
  const filePath = path.join(runtimeDir, 'visual-builder.js');
  const source = await fs.readFile(filePath, 'utf8');
  const matches = [];
  let index = source.indexOf('.forEach');
  while (index !== -1) {
    const start = Math.max(0, index - 180);
    const end = Math.min(source.length, index + 120);
    matches.push(source.slice(start, end).replace(/\s+/g, ' '));
    index = source.indexOf('.forEach', index + 8);
  }
  console.log('SELECTOR_FOREACH_DIAGNOSTICS', JSON.stringify(matches));
}
