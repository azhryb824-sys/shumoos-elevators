import { execFileSync } from 'node:child_process';
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
    )
    .replace(
      /let headerMenuMatch=pathname\.match\([^;]+\);/,
      "const headerMenuPath='/api/visual/menus/';const headerMenuIdText=pathname.startsWith(headerMenuPath)?pathname.slice(headerMenuPath.length):'';let headerMenuMatch=headerMenuIdText&&Number.isSafeInteger(Number(headerMenuIdText))?['',headerMenuIdText]:null;"
    );

  if (source.includes('headerMenuMatch=pathname.match')) {
    throw new Error('Header menu route repair was not applied.');
  }

  const fixedPath = path.join('/tmp', 'waqf-header-runtime-patch-fixed.mjs');
  await fs.writeFile(fixedPath, source);
  loadedModule = await import(`${pathToFileURL(fixedPath).href}?v=6`);
  return loadedModule;
}

async function repairGeneratedBuilder(runtimeDir) {
  const filePath = path.join(runtimeDir, 'visual-builder.js');
  let source = await fs.readFile(filePath, 'utf8');
  const brokenToggle = "onclick=\"this.closest('.waqf-custom-header').classList.toggle('is-mobile-open')\"";
  const safeToggle = "onclick=\"this.closest(&quot;.waqf-custom-header&quot;).classList.toggle(&quot;is-mobile-open&quot;)\"";
  source = source.replaceAll(brokenToggle, safeToggle);
  if (source.includes(brokenToggle)) {
    throw new Error('Visual editor header toggle repair was not applied.');
  }
  await fs.writeFile(filePath, source);
}

function validateBrowserAssets(runtimeDir) {
  for (const file of ['visual-builder.js', 'visual-public.js']) {
    execFileSync(process.execPath, ['--check', path.join(runtimeDir, file)], {
      stdio: 'inherit',
    });
  }
}

export async function applyHeaderRuntimePatch(runtimeDir) {
  const module = await loadFixedModule();
  const result = await module.applyHeaderRuntimePatch(runtimeDir);
  await repairGeneratedBuilder(runtimeDir);
  validateBrowserAssets(runtimeDir);
  return result;
}
