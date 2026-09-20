import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const payloadDir = path.join(__dirname, 'payload-v4b');
const logoDir = path.join(__dirname, 'logo-webp-payload');
const runtimeDir = path.join('/tmp', 'waqf-alathar-v4-runtime');
const archivePath = path.join('/tmp', 'waqf-alathar-v4.tar.gz');
const expectedHash = '94957f418392a9841c38bd892c146f78ec48feafd2cbe7321d3b0ab1b981730c';

const chunks = (await fs.readdir(payloadDir))
  .filter((name) => /^chunk-\d+\.txt$/.test(name))
  .sort();
if (!chunks.length) throw new Error('Deployment payload is missing.');

let encoded = '';
for (const name of chunks) encoded += await fs.readFile(path.join(payloadDir, name), 'utf8');
const archive = Buffer.from(encoded, 'base64');
const actualHash = createHash('sha256').update(archive).digest('hex');
if (actualHash !== expectedHash) {
  throw new Error(`Deployment payload checksum mismatch: ${actualHash}`);
}

await fs.rm(runtimeDir, { recursive: true, force: true });
await fs.mkdir(path.join(runtimeDir, 'assets'), { recursive: true });
await fs.writeFile(archivePath, archive);
execFileSync('tar', ['-xzf', archivePath, '-C', runtimeDir], { stdio: 'inherit' });

const logoParts = (await fs.readdir(logoDir))
  .filter((name) => /^part-\d+\.txt$/.test(name))
  .sort();
if (!logoParts.length) throw new Error('Logo payload is missing.');
let logoEncoded = '';
for (const name of logoParts) logoEncoded += await fs.readFile(path.join(logoDir, name), 'utf8');
await fs.writeFile(path.join(runtimeDir, 'assets', 'logo.png'), Buffer.from(logoEncoded, 'base64'));

// The approved compact logo stored with the deployment is WebP, while the
// application keeps the historical internal filename logo.png. Serve the
// bytes with their correct MIME type to preserve strict browser handling.
const serverPath = path.join(runtimeDir, 'server.mjs');
const serverSource = await fs.readFile(serverPath, 'utf8');
await fs.writeFile(serverPath, serverSource.replace("type: 'image/png'", "type: 'image/webp'"));

await import(pathToFileURL(serverPath).href);

// One-time production smoke check. Only response statuses are logged; no
// credentials, cookies, database keys, or response bodies are printed.
const timer = setTimeout(async () => {
  const port = Number(process.env.PORT || 3000);
  const base = `http://127.0.0.1:${port}`;
  const statuses = {};
  try {
    statuses.health = (await fetch(`${base}/api/health`, { redirect: 'manual' })).status;
    statuses.home = (await fetch(`${base}/`, { redirect: 'manual' })).status;
    statuses.store = (await fetch(`${base}/store`, { redirect: 'manual' })).status;
    statuses.loginPage = (await fetch(`${base}/login`, { redirect: 'manual' })).status;

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
        statuses.admin = (await fetch(`${base}/admin/`, {
          redirect: 'manual',
          headers: { Cookie: cookie },
        })).status;
      }
    }
  } catch (error) {
    statuses.error = error.message;
  }
  console.log('Startup smoke check:', JSON.stringify(statuses));
}, 1800);
timer.unref();
