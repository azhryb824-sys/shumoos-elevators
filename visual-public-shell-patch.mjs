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
const INJECTION_EXCLUDED = /^\/(admin|login|api|media|assets|visual-builder|visual-public|cms-admin|favicon\.ico|robots\.txt)(?:\/|\?|$)/;

let cache = { expiresAt: 0, pages: [], settings: {}, menu: [] };

const clean = (value = '') => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max, fallback) => Math.max(min, Math.min(max, num(value, fallback)));
const bool = (value, fallback = false) => value === undefined ? fallback : !!value;
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;

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
    expiresAt: Date.now() + 1500,
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

function normalizeHeader(source = {}) {
  const input = source && typeof source === 'object' ? source : {};
  return {
    enabled: bool(input.enabled, true),
    layout: ['logo_right', 'centered', 'logo_left', 'compact'].includes(input.layout) ? input.layout : 'logo_right',
    sticky: bool(input.sticky, true),
    shadow: bool(input.shadow, true),
    background: color(input.background, '#fffdf8'),
    text_color: color(input.text_color, '#1e2933'),
    accent_color: color(input.accent_color, '#b38b4d'),
    border_color: color(input.border_color, '#eadfc9'),
    max_width: clamp(input.max_width, 760, 1600, 1180),
    height: clamp(input.height, 58, 140, 84),
    padding_x: clamp(input.padding_x, 0, 64, 16),
    logo_size: clamp(input.logo_size, 32, 110, 66),
    show_logo: bool(input.show_logo, true),
    show_name: bool(input.show_name, true),
    show_city: bool(input.show_city, true),
    name_size: clamp(input.name_size, 12, 34, 18),
    city_size: clamp(input.city_size, 9, 24, 12),
    menu_size: clamp(input.menu_size, 11, 24, 14),
    menu_gap: clamp(input.menu_gap, 4, 46, 18),
    mobile_menu: bool(input.mobile_menu, true),
    cta_enabled: bool(input.cta_enabled, true),
    cta_label: clean(input.cta_label || 'المتجر').slice(0, 80),
    cta_url: clean(input.cta_url || '/store').slice(0, 500),
    cta_background: color(input.cta_background, '#b38b4d'),
    cta_text_color: color(input.cta_text_color, '#ffffff'),
    cta_radius: clamp(input.cta_radius, 0, 40, 12),
    announcement_enabled: bool(input.announcement_enabled, false),
    announcement_text: clean(input.announcement_text || '').slice(0, 300),
    announcement_label: clean(input.announcement_label || '').slice(0, 80),
    announcement_url: clean(input.announcement_url || '').slice(0, 500),
    announcement_background: color(input.announcement_background, '#0d2b46'),
    announcement_text_color: color(input.announcement_text_color, '#ffffff'),
    announcement_size: clamp(input.announcement_size, 10, 22, 13)
  };
}

function headerStyleVars(header) {
  return [
    `--waqf-header-bg:${header.background}`,
    `--waqf-header-text:${header.text_color}`,
    `--waqf-header-accent:${header.accent_color}`,
    `--waqf-header-border:${header.border_color}`,
    `--waqf-header-max:${header.max_width}px`,
    `--waqf-header-height:${header.height}px`,
    `--waqf-header-pad:${header.padding_x}px`,
    `--waqf-logo-size:${header.logo_size}px`,
    `--waqf-name-size:${header.name_size}px`,
    `--waqf-city-size:${header.city_size}px`,
    `--waqf-menu-size:${header.menu_size}px`,
    `--waqf-menu-gap:${header.menu_gap}px`,
    `--waqf-cta-bg:${header.cta_background}`,
    `--waqf-cta-text:${header.cta_text_color}`,
    `--waqf-cta-radius:${header.cta_radius}px`,
    `--waqf-announcement-bg:${header.announcement_background}`,
    `--waqf-announcement-text:${header.announcement_text_color}`,
    `--waqf-announcement-size:${header.announcement_size}px`
  ].join(';');
}

function logoUrl(site) {
  const id = Number(site.logo_media_id);
  return Number.isSafeInteger(id) && id > 0 ? `/media/${id}` : '/assets/logo.png';
}

function renderHeader(chrome) {
  const site = chrome.settings.site || {};
  const header = normalizeHeader(chrome.settings.header || {});
  if (!header.enabled) return '';

  const links = (chrome.menu || [])
    .filter((item) => item.location === 'header' && item.published !== false)
    .filter((item) => !header.cta_enabled || String(item.url || '') !== String(header.cta_url || ''))
    .map((item) => `<a href="${esc(item.url || '#')}"${item.new_tab ? ' target="_blank" rel="noopener"' : ''}>${esc(item.label || 'رابط')}</a>`)
    .join('');

  const announcement = header.announcement_enabled && header.announcement_text
    ? `<div class="waqf-announcement"><span>${esc(header.announcement_text)}</span>${header.announcement_label && header.announcement_url ? `<a href="${esc(header.announcement_url)}">${esc(header.announcement_label)}</a>` : ''}</div>`
    : '';

  const brandContent = [
    header.show_logo ? `<img class="waqf-header-logo" src="${logoUrl(site)}" onerror="this.onerror=null;this.src='/assets/logo.png'" alt="${esc(site.name || 'وقف الأثر الجميل')}">` : '',
    header.show_name || header.show_city
      ? `<span>${header.show_name ? `<strong>${esc(site.name || 'وقف الأثر الجميل')}</strong>` : ''}${header.show_city ? `<small>${esc(site.city || 'مكة المكرمة')}</small>` : ''}</span>`
      : ''
  ].join('');

  const cta = header.cta_enabled
    ? `<a class="waqf-header-cta" href="${esc(header.cta_url || '#')}">${esc(header.cta_label || 'المتجر')}</a>`
    : '';

  return `<header class="waqf-custom-header waqf-header-layout-${esc(header.layout)}${header.sticky ? ' is-sticky' : ''}${header.shadow ? ' has-shadow' : ''}${header.mobile_menu ? ' has-mobile-menu' : ''}" style="${headerStyleVars(header)}" data-waqf-editable-header="1">${announcement}<nav class="waqf-header-nav"><a class="waqf-header-brand" href="/">${brandContent}</a>${header.mobile_menu ? `<button class="waqf-header-toggle" type="button" onclick="this.closest('.waqf-custom-header').classList.toggle('is-mobile-open')" aria-label="فتح القائمة">☰</button>` : ''}<div class="waqf-header-menu">${links}${cta}</div></nav></header>`;
}

function footerLinks(menu = []) {
  return menu
    .filter((item) => item.location === 'footer' && item.published !== false)
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
<link rel="icon" href="${logoUrl(site)}" type="image/webp">
<link rel="stylesheet" href="/visual-public.css?v=10">
<style>
:root{--wb-primary:${esc(primary)};--wb-accent:${esc(accent)};--wb-bg:${esc(background)};--wb-surface:${esc(surface)};--wb-text:${esc(text)};--wb-muted:${esc(muted)}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--wb-bg);color:var(--wb-text);font-family:'Cairo',Tahoma,Arial,sans-serif}.waqf-shell-footer{background:#081d30;color:#d7e1e8;padding:42px 16px 22px}.waqf-shell-footer-inner{width:min(1180px,100%);margin:auto;display:grid;grid-template-columns:2fr 1fr;gap:34px}.waqf-shell-footer h3{color:#fff;margin:0 0 8px}.waqf-shell-footer p{color:#aebec9}.waqf-shell-footer a{display:inline-block;color:#d7e1e8;text-decoration:none;margin:5px 0 5px 14px}.waqf-shell-copy{width:min(1180px,100%);margin:25px auto 0;border-top:1px solid rgba(255,255,255,.1);padding-top:16px;color:#8fa2b0;font-size:12px}.waqf-shell-loading{min-height:55vh;display:grid;place-items:center;color:var(--wb-muted)}@media(max-width:900px){.waqf-shell-footer-inner{grid-template-columns:1fr}}
</style>
</head>
<body>
${renderHeader(chrome)}
<main id="visualPageRoot"><div class="waqf-shell-loading">جارٍ تحميل الصفحة…</div></main>
<footer class="waqf-shell-footer"><div class="waqf-shell-footer-inner"><div><h3>${esc(site.name || 'وقف الأثر الجميل')}</h3><p>${esc(site.footer_text || site.tagline || '')}</p></div><div>${footerLinks(chrome.menu)}</div></div><div class="waqf-shell-copy">© ${new Date().getFullYear()} ${esc(site.name || 'وقف الأثر الجميل')}</div></footer>
<script defer src="/visual-public.js?v=10"></script>
</body></html>`;
}

function injectHeaderIntoHtml(html, chrome) {
  let output = String(html || '');
  if (!output || output.includes('data-waqf-editable-header="1"')) return output;
  const header = renderHeader(chrome);
  if (!header) return output;

  output = output
    .replace(/<div class=["']topline["']><\/div>\s*<header class=["']header["'][^>]*>[\s\S]*?<\/header>/i, '')
    .replace(/<header class=["']header["'][^>]*>[\s\S]*?<\/header>/i, '');

  if (!output.includes('/visual-public.css?v=10')) {
    const styles = `<link rel="stylesheet" href="/visual-public.css?v=10"><style data-waqf-header-compat>body>.topline,body>header.header,.topline+.header{display:none!important}</style>`;
    output = output.includes('</head>') ? output.replace('</head>', `${styles}</head>`) : styles + output;
  }

  return /<body[^>]*>/i.test(output)
    ? output.replace(/<body([^>]*)>/i, `<body$1>${header}`)
    : header + output;
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

function stripContentLength(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return headers;
  const next = { ...headers };
  for (const key of Object.keys(next)) if (key.toLowerCase() === 'content-length') delete next[key];
  return next;
}

const previousCreateServer = http.createServer.bind(http);
http.createServer = function createVisualPublicShell(listener, ...args) {
  const wrapped = async (req, res) => {
    if (req.headers['x-waqf-public-shell-bypass'] === '1') return listener(req, res);
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'GET') {
      const slug = resolveSlug(pathname);
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

    const injectable = req.method === 'GET' && !INJECTION_EXCLUDED.test(pathname);
    if (!injectable) return listener(req, res);

    const chromePromise = loadChrome().catch((error) => {
      console.error('Editable header injection skipped:', error?.message || error);
      return null;
    });
    const originalWriteHead = res.writeHead.bind(res);
    const originalEnd = res.end.bind(res);

    res.writeHead = (statusCode, statusMessage, headers) => {
      let reason = statusMessage;
      let headerObject = headers;
      if (reason && typeof reason === 'object') {
        headerObject = reason;
        reason = undefined;
      }
      headerObject = stripContentLength(headerObject);
      return reason === undefined
        ? originalWriteHead(statusCode, headerObject)
        : originalWriteHead(statusCode, reason, headerObject);
    };

    res.end = (chunk, encoding, callback) => {
      const type = String(res.getHeader('content-type') || '');
      const candidate = chunk && (typeof chunk === 'string' || Buffer.isBuffer(chunk))
        ? (Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk))
        : '';
      const looksHtml = type.includes('text/html') || /<!doctype html|<html[\s>]/i.test(candidate);
      if (!candidate || !looksHtml) return originalEnd(chunk, encoding, callback);

      chromePromise.then((chrome) => {
        if (!chrome) return originalEnd(chunk, encoding, callback);
        if (!res.headersSent) res.removeHeader('Content-Length');
        return originalEnd(injectHeaderIntoHtml(candidate, chrome), encoding, callback);
      }).catch(() => originalEnd(chunk, encoding, callback));
      return res;
    };

    return listener(req, res);
  };
  return previousCreateServer(wrapped, ...args);
};
