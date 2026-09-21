import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function inspectVisualRuntime(runtimeDir) {
  if (process.env.WAQF_INSPECT_VISUAL !== '1') return;
  const files = ['visual-public.js', 'visual-builder-patch.mjs', 'visual-builder.js'];
  for (const file of files) {
    const fullPath = path.join(runtimeDir, file);
    try {
      const source = await fs.readFile(fullPath, 'utf8');
      const chunkSize = 3500;
      const total = Math.ceil(source.length / chunkSize);
      console.log(`VISUAL_SOURCE_BEGIN ${file} ${source.length} ${total}`);
      for (let index = 0; index < total; index += 1) {
        const chunk = source.slice(index * chunkSize, (index + 1) * chunkSize);
        console.log(`VISUAL_SOURCE_CHUNK ${file} ${index + 1}/${total} ${Buffer.from(chunk, 'utf8').toString('base64')}`);
      }
      console.log(`VISUAL_SOURCE_END ${file}`);
    } catch (error) {
      console.log(`VISUAL_SOURCE_ERROR ${file} ${error.message}`);
    }
  }
}
