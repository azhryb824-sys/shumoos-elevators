import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const payloadDir = path.join(__dirname, 'payload-v4b');
const cmsPayloadDir = path.join(__dirname, 'payload-cms-v5');
const visualPayloadDir = path.join(__dirname, 'payload-visual-v6');
const logoDir = path.join(__dirname, 'logo-webp-payload');
const runtimeDir = path.join('/tmp', 'waqf-alathar-v6-runtime');
const archivePath = path.join('/tmp', 'waqf-alathar-v4.tar.gz');
const cmsArchivePath = path.join('/tmp', 'waqf-cms-v5.tar.gz');
const visualArchivePath = path.join('/tmp', 'waqf-visual-v6.tar.gz');
const expectedHash = '94957f418392a9841c38bd892c146f78ec48feafd2cbe7321d3b0ab1b981730c';
const expectedCmsHash = '99509079d9fc754c43970372aed108d26b89273e8777f58431e34df3e3c97722';
const expectedVisualHash = '5ee52d124e2ff480ba6e32b6fc615a77835a3dca74be5946d792380e4e7830b7';

async function readPayload(directory, pattern, expected, outputPath) {
  const chunks = (await fs.readdir(directory)).filter((name) => pattern.test(name)).sort();
  if (!chunks.length) throw new Error(`Deployment payload is missing: ${directory}`);
  let encoded = '';
  for (const name of chunks) encoded += await fs.readFile(path.join(directory, name), 'utf8');
  const archive = Buffer.from(encoded, 'base64');
  const actual = createHash('sha256').update(archive).digest('hex');
  if (actual !== expected) throw new Error(`Deployment payload checksum mismatch: ${actual}`);
  await fs.writeFile(outputPath, archive);
}

await fs.rm(runtimeDir, { recursive: true, force: true });
await fs.mkdir(path.join(runtimeDir, 'assets'), { recursive: true });
await readPayload(payloadDir, /^chunk-\d+\.txt$/, expectedHash, archivePath);
execFileSync('tar', ['-xzf', archivePath, '-C', runtimeDir], { stdio: 'inherit' });
await readPayload(cmsPayloadDir, /^chunk-\d+\.txt$/, expectedCmsHash, cmsArchivePath);
execFileSync('tar', ['-xzf', cmsArchivePath, '-C', runtimeDir], { stdio: 'inherit' });
await readPayload(visualPayloadDir, /^chunk-\d+\.txt$/, expectedVisualHash, visualArchivePath);
execFileSync('tar', ['-xzf', visualArchivePath, '-C', runtimeDir], { stdio: 'inherit' });

const logoParts = (await fs.readdir(logoDir)).filter((name) => /^part-\d+\.txt$/.test(name)).sort();
if (!logoParts.length) throw new Error('Logo payload is missing.');
let logoEncoded = '';
for (const name of logoParts) logoEncoded += await fs.readFile(path.join(logoDir, name), 'utf8');
await fs.writeFile(path.join(runtimeDir, 'assets', 'logo.png'), Buffer.from(logoEncoded, 'base64'));

const serverPath = path.join(runtimeDir, 'server.mjs');
const serverSource = await fs.readFile(serverPath, 'utf8');
await fs.writeFile(serverPath, serverSource.replace("type: 'image/png'", "type: 'image/webp'"));

// Apply a narrow runtime hotfix to the public-page lookup. Fetching the
// page list first makes the renderer independent of PostgREST filter parsing
// while keeping the same RLS and server-key protection used by the builder.
const visualPatchPath = path.join(runtimeDir, 'visual-builder-patch.mjs');
let visualPatchSource = await fs.readFile(visualPatchPath, 'utf8');
const oldPublicLoader = "const pages=await sb(`waqf_pages?select=*&slug=eq.${encodeFilter(slug)}&published=eq.true&limit=1`);const page=pages?.[0];";
const newPublicLoader = "const pages=await sb('waqf_pages?select=*&order=sort_order.asc,id.asc');const wanted=clean(slug).toLowerCase();const page=(pages||[]).find(row=>row.published!==false&&clean(row.slug).toLowerCase()===wanted);";
if (visualPatchSource.includes(oldPublicLoader)) {
  visualPatchSource = visualPatchSource.replace(oldPublicLoader, newPublicLoader);
  await fs.writeFile(visualPatchPath, visualPatchSource);
} else if (!visualPatchSource.includes(newPublicLoader)) {
  throw new Error('Visual public-page loader hotfix target was not found.');
}

// Import the visual builder first so it can serve its routes and observe the
// final HTML produced by the existing CMS and application wrappers.
await import(pathToFileURL(visualPatchPath).href);
await import(pathToFileURL(path.join(runtimeDir, 'cms-patch.mjs')).href);
await import(pathToFileURL(serverPath).href);

const timer = setTimeout(async () => {
  const port = Number(process.env.PORT || 3000);
  const base = `http://127.0.0.1:${port}`;
  const statuses = {};
  try {
    statuses.health = (await fetch(`${base}/api/health`, { redirect: 'manual' })).status;
    statuses.home = (await fetch(`${base}/`, { redirect: 'manual' })).status;
    statuses.store = (await fetch(`${base}/store`, { redirect: 'manual' })).status;
    statuses.loginPage = (await fetch(`${base}/login`, { redirect: 'manual' })).status;
    statuses.cmsAsset = (await fetch(`${base}/cms-admin.js`, { redirect: 'manual' })).status;
    statuses.visualAsset = (await fetch(`${base}/visual-builder.js`, { redirect: 'manual' })).status;
    statuses.publicRenderer = (await fetch(`${base}/visual-public.js`, { redirect: 'manual' })).status;

    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      const loginResponse = await fetch(`${base}/api/login`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
      });
      statuses.login = loginResponse.status;
      const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0] || '';
      if (cookie) {
        const adminResponse = await fetch(`${base}/admin/`, { redirect: 'manual', headers: { Cookie: cookie } });
        statuses.admin = adminResponse.status;
        const adminHtml = await adminResponse.text();
        statuses.cmsInjected = adminHtml.includes('cmsStudioMount') ? 200 : 500;
        statuses.visualLauncher = adminHtml.includes('vb-visual-launcher') ? 200 : 500;
        statuses.designer = (await fetch(`${base}/admin/designer`, { redirect: 'manual', headers: { Cookie: cookie } })).status;

        const cmsTokenMatch = adminHtml.match(/window\.WAQF_CMS_TOKEN=("(?:\\.|[^"\\])*")/);
        if (cmsTokenMatch) {
          const cmsToken = JSON.parse(cmsTokenMatch[1]);
          statuses.cmsBootstrap = (await fetch(`${base}/api/cms/bootstrap`, {
            redirect: 'manual',
            headers: { Cookie: cookie, 'x-waqf-cms-token': cmsToken },
          })).status;
        }

        const designerResponse = await fetch(`${base}/admin/designer`, { redirect: 'manual', headers: { Cookie: cookie } });
        const designerHtml = await designerResponse.text();
        const visualTokenMatch = designerHtml.match(/window\.WAQF_VISUAL_TOKEN=("(?:\\.|[^"\\])*")/);
        if (visualTokenMatch) {
          const visualToken = JSON.parse(visualTokenMatch[1]);
          statuses.visualBootstrap = (await fetch(`${base}/api/visual/bootstrap`, {
            redirect: 'manual',
            headers: { Cookie: cookie, 'x-waqf-visual-token': visualToken },
          })).status;
          statuses.visualPublicPage = (await fetch(`${base}/api/visual/public-page?slug=home`, { redirect: 'manual' })).status;
        }
      }
    }
  } catch (error) {
    statuses.error = error.message;
  }
  console.log('Startup smoke check:', JSON.stringify(statuses));
}, 2400);
timer.unref();
