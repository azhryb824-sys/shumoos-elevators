import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function inspectOgMediaReferences(runtimeDir) {
  if (process.env.WAQF_INSPECT_OG_MEDIA !== '1') return;
  const files = ['visual-builder.js', 'visual-builder-patch.mjs', 'cms-admin.js', 'cms-patch.mjs'];
  for (const file of files) {
    const fullPath = path.join(runtimeDir, file);
    try {
      const source = await fs.readFile(fullPath, 'utf8');
      const snippets = [];
      let index = source.indexOf('og_media_id');
      while (index !== -1 && snippets.length < 20) {
        const start = Math.max(0, index - 260);
        const end = Math.min(source.length, index + 520);
        snippets.push(source.slice(start, end).replace(/\s+/g, ' '));
        index = source.indexOf('og_media_id', index + 11);
      }
      console.log(`OG_MEDIA_REFERENCE_SNIPPETS ${file} ${JSON.stringify(snippets)}`);
    } catch (error) {
      console.log(`OG_MEDIA_REFERENCE_ERROR ${file} ${error.message}`);
    }
  }
}
