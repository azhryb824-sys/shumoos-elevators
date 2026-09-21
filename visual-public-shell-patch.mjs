import http from 'node:http';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY || '';
const SERVER_KEY = process.env.WAQF_SERVER_KEY || process.env.SUPABASE_SERVER_KEY || '';
const RESERVED = new Set([
  'store', 'cart', 'checkout', 'product', 'products', 'projects', 'project',
  'contact', 'reports', 'login', 'admin', 'api', 'media', 'assets',
  'visual-builder.js', 'visual-builder.css', 'visual-public.js', 'visual-public.css',
  'cms-admin.js', 'cms-admin.css', 'favicon.ico', 'robots.txt'
]);

let cache = { expiresAt: 0, pages: [], settings: {}, menu: [] };

const clean = (value = '') => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

async function sb(endpoint) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !SERVER_KEY) throw new Error('database_configuration_missing');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'x-waqf-server-key': SERVER_KEY,
      Accept: 'application/json'
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.details || `database_error_${response.status}`);
  return data;
}

function settingsObject(rows = []) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value || {}]));
}

async function loadChrome() {
  if (cache.expiresAt > Date.now()) return cache;
  const [pages, settingsRows, menu] = await Promise.all([
    sb('waqf_pages?select=id,slug,title,excerpt,meta_title,meta_description,published,sort_order&order=sort_order.asc,id.asc'),
    sb('waqf_settings?select=key,value'),
    sb('waqf_menu_items?select=*&published=eq.true&order=location.asc,sort_order.asc,id.asc')
  ]);
  cache = {
    expiresAt: Date.now() + 10_000,
    pages: pages || [],
    settings: settingsObject(settingsRows || []),
    menu: menu || []
  };
  return cache;
}

function resolveSlug(pathname) {
  const path = String(pathname || '/').replace(/^\/+|\/+$/g, '');
  if (!path) return 'home';
  const parts = path.split('/').filter(Boolean);
  if ((parts[0] === 'page' || parts[0] === 'pages') && parts[1]) return clean(decodeURIComponent(parts[1])).toLowerCase();
  if (parts.length !== 1 || RESERVED.has(parts[0])) return '';
  return clean(decodeURIComponent(parts[0])).toLowerCase();
}

function navHtml(menu = [], location = 'header') {
  return menu
    .filter((item) => item.location === location && item.published !== false)
    .map((item) => `<a href="${esc(item.url || '#')}"${item.new_tab ? ' target="_blank" rel="noopener"' : ''}>${esc(item.label)}</a>`)
    .join('');
}

function shell(page, chrome) {
  const site = chrome.settings.site || {};
  const design = chrome.settings.design || {};
  const primary = design.primary || site.primary_color || '#0d2b46';
  const accent = design.accent || site.accent_color || '#b38b4d';
  const background = design.background || '#f7f3ea';
  const surface = design.surface || '#fffdf8';
  const text = design.text || '#1e2933';
  const muted = design.muted || '#687783';
  const title = page.meta_title || page.title || site.name || 'وقف الأثر الجميل';
  const description = page.meta_description || page.excerpt || site.tagline || '';
  const headerLinks = navHtml(chrome.menu, 'header');
  const footerLinks = navHtml(chrome.menu, 'footer');
  const homeUrl = '/';
  return `<!doctype html>
<html lang="ar" dir="rtl" data-waqf-visual-shell="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="${esc(primary)}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="icon" href="/assets/logo.png" type="image/webp">
<link rel="stylesheet" href="/visual-public.css?v=7">
<style>
:root{--wb-primary:${esc(primary)};--wb-accent:${esc(accent)};--wb-bg:${esc(background)};--wb-surface:${esc(surface)};--wb-text:${esc(text)};--wb-muted:${esc(muted)}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--wb-bg);color:var(--wb-text);font-family:'Cairo',Tahoma,Arial,sans-serif}.waqf-shell-header{position:sticky;top:0;z-index:1000;background:color-mix(in srgb,var(--wb-surface) 94%,transparent);border-bottom:1px solid color-mix(in srgb,var(--wb-accent) 24%,transparent);backdrop-filter:blur(15px)}.waqf-shell-nav{width:min(1180px,calc(100% - 32px));min-height:84px;margin:auto;display:flex;align-items:center;gap:24px}.waqf-shell-brand{display:flex;align-items:center;gap:12px;margin-left:auto;text-decoration:none;color:var(--wb-primary)}.waqf-shell-brand img{width:66px;height:66px;object-fit:contain}.waqf-shell-brand strong{display:block;font-size:18px}.waqf-shell-brand small{display:block;color:var(--wb-accent)}.waqf-shell-links{display:flex;align-items:center;gap:18px;font-size:14px;font-weight:800}.waqf-shell-links a{text-decoration:none;color:var(--wb-text)}.waqf-shell-links a:hover{color:var(--wb-accent)}.waqf-shell-store{border-radius:12px;padding:10px 16px;background:var(--wb-accent);color:#fff!important}.waqf-shell-footer{background:#081d30;color:#d7e1e8;padding:42px 16px 22px}.waqf-shell-footer-inner{width:min(1180px,100%);margin:auto;display:grid;grid-template-columns:2fr 1fr;gap:34px}.waqf-shell-footer h3{color:#fff;margin:0 0 8px}.waqf-shell-footer p{color:#aebec9}.waqf-shell-footer a{display:inline-block;color:#d7e1e8;text-decoration:none;margin:5px 0 5px 14px}.waqf-shell-copy{width:min(1180px,100%);margin:25px auto 0;border-top:1px solid rgba(255,255,255,.1);padding-top:16px;color:#8fa2b0;font-size:12px}.waqf-shell-loading{min-height:55vh;display:grid;place-items:center;color:var(--wb-muted)}
@media(max-width:900px){.waqf-shell-links{display:none}.waqf-shell-nav{min-height:74px}.waqf-shell-brand img{width:54px;height:54px}.waqf-shell-footer-inner{grid-template-columns:1fr}}
</style>
</head>
<body>
<header class="waqf-shell-header"><nav class="waqf-shell-nav"><a class="waqf-shell-brand" href="${homeUrl}"><img src="/assets/logo.png" alt="${esc(site.name || 'وقف الأثر الجميل')}"><span><strong>${esc(site.name || 'وقف الأثر الجميل')}</strong><small>${esc(site.city || 'مكة المكرمة')}</small></span></a><div class="waqf-shell-links">${headerLinks}<a class="waqf-shell-store" href="/store">المتجر</a></div></nav></header>
<main id="visualPageRoot"><div class="waqf-shell-loading">جارٍ تحميل الصفحة…</div></main>
<footer class="waqf-shell-footer"><div class="waqf-shell-footer-inner"><div><h3>${esc(site.name || 'وقف الأثر الجميل')}</h3><p>${esc(site.footer_text || site.tagline || '')}</p></div><div>${footerLinks}</div></div><div class="waqf-shell-copy">© ${new Date().getFullYear()} ${esc(site.name || 'وقف الأثر الجميل')}</div></footer>
<script defer src="/visual-public.js?v=7"></script>
</body></html>`;
}

function sendHtml(res, html) {
  const body = Buffer.from(html);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end(body);
}

const previousCreateServer = http.createServer.bind(http);
http.createServer = function createVisualPublicShell(listener, ...args) {
  const wrapped = async (req, res) => {
    if (req.headers['x-waqf-public-shell-bypass'] === '1') return listener(req, res);
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET') {
      const slug = resolveSlug(url.pathname);
      if (slug) {
        try {
          const chrome = await loadChrome();
          const page = chrome.pages.find((row) => row.published !== false && clean(row.slug).toLowerCase() === slug);
          if (page) return sendHtml(res, shell(page, chrome));
        } catch (error) {
          console.error('Visual public shell fallback:', error?.message || error);
        }
      }
    }
    return listener(req, res);
  };
  return previousCreateServer(wrapped, ...args);
};
