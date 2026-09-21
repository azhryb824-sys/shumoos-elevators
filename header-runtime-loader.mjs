import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let loadedModule = null;

async function loadFixedModule() {
  if (loadedModule) return loadedModule;
  const sourcePath = path.join(__dirname, 'header-runtime-patch.mjs');
  let source = await fs.readFile(sourcePath, 'utf8');
  source = source
    .replace(
      "const rows=await sb(`waqf_menu_items?id=eq.${headerMenuMatch[1]}`,{method:'PATCH',body})",
      "const rows=await sb('waqf_menu_items?id=eq.'+headerMenuMatch[1],{method:'PATCH',body})"
    )
    .replace(
      "await sb(`waqf_menu_items?id=eq.${headerMenuMatch[1]}`,{method:'DELETE',prefer:'return=minimal'})",
      "await sb('waqf_menu_items?id=eq.'+headerMenuMatch[1],{method:'DELETE',prefer:'return=minimal'})"
    );
  const fixedPath = path.join('/tmp', 'waqf-header-runtime-patch-fixed.mjs');
  await fs.writeFile(fixedPath, source);
  loadedModule = await import(`${pathToFileURL(fixedPath).href}?v=2`);
  return loadedModule;
}

export async function applyHeaderRuntimePatch(runtimeDir) {
  const module = await loadFixedModule();
  return module.applyHeaderRuntimePatch(runtimeDir);
}
