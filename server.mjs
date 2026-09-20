import http from 'node:http';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AtharMakkah2026!';
const COOKIE_NAME = 'waqf_admin_session';
const SESSION_MAX_AGE = 8 * 60 * 60;
const sessions = new Map();

const logoDir = path.join(__dirname, 'logo-webp-payload');
const logoParts = (await fs.readdir(logoDir))
  .filter((name) => /^part-\d+\.txt$/.test(name))
  .sort();
if (!logoParts.length) throw new Error('Logo payload is missing.');
const logoBase64 = (await Promise.all(logoParts.map((name) => fs.readFile(path.join(logoDir, name), 'utf8')))).join('');
const logoBuffer = Buffer.from(logoBase64, 'base64');

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie || '')[COOKIE_NAME];
  if (!token) return null;
  const record = sessions.get(token);
  if (!record || record.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  record.expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  return record;
}

function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) reject(new Error('Request body is too large.'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    ...headers,
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

function loginPage(error = '') {
  const safeError = String(error).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d2b46">
<title>تسجيل الدخول | وقف الأثر الجميل</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="icon" href="/assets/logo.png?v=3" type="image/webp">
<style>
:root{--navy:#0d2b46;--navy2:#153f61;--gold:#b38b4d;--cream:#f7f3ea;--paper:#fffdf8;--text:#1e2933;--muted:#687783;--line:#e5d8c3;--danger:#a63b3b}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:'Cairo',Tahoma,Arial,sans-serif;background:radial-gradient(circle at 15% 15%,rgba(179,139,77,.15),transparent 30%),linear-gradient(135deg,#071b2c,#0d2b46 58%,#174d73);display:grid;place-items:center;padding:24px;color:var(--text)}
.login-shell{width:min(1040px,100%);display:grid;grid-template-columns:1fr .92fr;background:var(--paper);border-radius:30px;overflow:hidden;box-shadow:0 35px 90px rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.2)}
.identity{padding:58px 46px;background:linear-gradient(145deg,rgba(13,43,70,.98),rgba(25,78,112,.96));color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative;overflow:hidden}.identity:before,.identity:after{content:'';position:absolute;border:1px solid rgba(213,183,124,.22);border-radius:50%}.identity:before{width:330px;height:330px;top:-180px;right:-150px}.identity:after{width:240px;height:240px;bottom:-130px;left:-100px}
.identity img{width:min(260px,78%);height:auto;background:#fffaf1;border-radius:22px;padding:10px;box-shadow:0 22px 55px rgba(0,0,0,.22);position:relative}.identity h1{font-size:30px;margin:24px 0 4px;position:relative}.identity p{margin:0;color:#d8e4eb;position:relative}.form-side{padding:56px 48px;display:flex;flex-direction:column;justify-content:center}.form-side small{color:var(--gold);font-weight:800}.form-side h2{color:var(--navy);font-size:32px;margin:6px 0}.form-side>p{color:var(--muted);margin:0 0 28px}.field{display:grid;gap:7px;margin-bottom:17px}.field label{font-weight:700;color:var(--navy)}.field input{width:100%;border:1px solid var(--line);border-radius:13px;padding:13px 15px;background:#fff;font:inherit;outline:none;transition:.2s}.field input:focus{border-color:var(--gold);box-shadow:0 0 0 4px rgba(179,139,77,.12)}.submit{width:100%;border:0;border-radius:13px;padding:14px 18px;background:linear-gradient(135deg,var(--gold),#c9a260);color:#fff;font:800 16px 'Cairo',sans-serif;cursor:pointer;box-shadow:0 12px 28px rgba(179,139,77,.25)}.submit:disabled{opacity:.65;cursor:wait}.message{min-height:27px;color:var(--danger);font-size:14px;margin-top:10px}.back{display:inline-flex;margin-top:18px;color:var(--navy);font-weight:700}.security{margin-top:22px;padding:12px 14px;background:#f4eee4;border-radius:12px;color:var(--muted);font-size:12px}
@media(max-width:780px){.login-shell{grid-template-columns:1fr}.identity{padding:30px 24px}.identity img{width:175px}.identity h1{font-size:23px}.form-side{padding:36px 24px}.form-side h2{font-size:27px}}
</style>
</head>
<body>
<main class="login-shell">
<section class="identity"><img src="/assets/logo.png?v=3" alt="شعار وقف الأثر الجميل"><h1>وقف الأثر الجميل</h1><p>مكة المكرمة</p></section>
<section class="form-side"><small>النظام الإداري</small><h2>تسجيل الدخول</h2><p>أدخل بيانات حسابك للوصول إلى لوحة إدارة الوقف والمتجر.</p>
<form id="loginForm" autocomplete="on">
<div class="field"><label for="username">اسم المستخدم</label><input id="username" name="username" autocomplete="username" required autofocus></div>
<div class="field"><label for="password">كلمة المرور</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
<button class="submit" type="submit">دخول آمن إلى النظام</button><div class="message" id="message">${safeError}</div>
</form>
<a class="back" href="/">العودة إلى الموقع العام ←</a><div class="security">صفحة الدخول محمية بجلسة آمنة، ولا تُعرض لوحة الإدارة قبل نجاح التحقق.</div>
</section></main>
<script>
const form=document.getElementById('loginForm'),message=document.getElementById('message'),button=form.querySelector('button');
form.addEventListener('submit',async(event)=>{event.preventDefault();message.textContent='';button.disabled=true;button.textContent='جارٍ التحقق...';try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'تعذر تسجيل الدخول.');location.replace('/admin/');}catch(error){message.textContent=error.message||'بيانات الدخول غير صحيحة.';button.disabled=false;button.textContent='دخول آمن إلى النظام';}});
</script>
</body></html>`;
}

function enhanceHtml(html, pathname) {
  let output = String(html)
    .replaceAll('/logo.svg', '/assets/logo.png?v=3')
    .replaceAll('font-family:Tahoma,Arial,sans-serif', "font-family:'Cairo',Tahoma,Arial,sans-serif");
  const headExtras = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><link rel="icon" href="/assets/logo.png?v=3" type="image/webp"><style>html,body,button,input,textarea,select{font-family:'Cairo',Tahoma,Arial,sans-serif!important}.brand img,.side-brand img{height:auto!important;object-fit:contain!important}.brand img{width:72px!important}.hero-card img{width:min(260px,85%)!important;height:auto!important;background:#fffaf0;border-radius:18px;padding:8px}.side-brand img{width:58px!important;background:#fffaf0;border-radius:10px;padding:4px}.admin-logout{position:fixed;left:22px;bottom:22px;z-index:1000;border:0;border-radius:12px;padding:10px 17px;background:#b38b4d;color:#fff;font:800 14px 'Cairo',sans-serif;cursor:pointer;box-shadow:0 12px 28px rgba(0,0,0,.2)}</style>`;
  output = output.includes('</head>') ? output.replace('</head>', `${headExtras}</head>`) : headExtras + output;
  if (pathname.startsWith('/admin') && output.includes('</body>')) {
    output = output.replace('</body>', `<form method="post" action="/api/logout"><button class="admin-logout" type="submit">تسجيل الخروج</button></form></body>`);
  }
  return output;
}

const originalCreateServer = http.createServer.bind(http);
http.createServer = function patchedCreateServer(listener, ...args) {
  const wrapped = async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const session = getSession(req);

    if (pathname === '/assets/logo.png' || pathname === '/logo.svg') {
      res.writeHead(200, {
        'Content-Type': 'image/webp',
        'Content-Length': logoBuffer.length,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(logoBuffer);
      return;
    }

    if (pathname === '/admin/login' && req.method === 'GET') {
      if (session) return redirect(res, '/admin/');
      return send(res, 200, loginPage(url.searchParams.get('error') || ''));
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const type = String(req.headers['content-type'] || '');
        const data = type.includes('application/json') ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw));
        const username = String(data.username || '');
        const password = String(data.password || '');
        const usernameOk = safeEqual(username, ADMIN_USERNAME);
        const passwordOk = safeEqual(password, ADMIN_PASSWORD);
        if (!usernameOk || !passwordOk) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ ok: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }));
          return;
        }
        const token = crypto.randomBytes(32).toString('base64url');
        sessions.set(token, { username, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 });
        const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}${secure}`,
        });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ ok: false, message: 'تعذر قراءة بيانات الدخول.' }));
      }
      return;
    }

    if (pathname === '/api/logout' && (req.method === 'POST' || req.method === 'GET')) {
      const token = parseCookies(req.headers.cookie || '')[COOKIE_NAME];
      if (token) sessions.delete(token);
      res.writeHead(302, {
        Location: '/admin/login',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
      });
      res.end();
      return;
    }

    if ((pathname === '/admin' || pathname.startsWith('/admin/')) && !session) {
      return redirect(res, '/admin/login');
    }

    if (session) {
      req.headers.authorization = `Basic ${Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64')}`;
    }

    const originalEnd = res.end.bind(res);
    res.end = (chunk, encoding, callback) => {
      if (chunk && (typeof chunk === 'string' || Buffer.isBuffer(chunk))) {
        const contentType = String(res.getHeader('content-type') || '');
        const candidate = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        if (contentType.includes('text/html') || candidate.includes('<!doctype html') || candidate.includes('<html')) {
          const enhanced = enhanceHtml(candidate, pathname);
          res.removeHeader('Content-Length');
          res.setHeader('Cache-Control', 'no-store, max-age=0');
          return originalEnd(enhanced, encoding, callback);
        }
        if (contentType.includes('text/css')) {
          const enhanced = candidate.replaceAll('font-family:Tahoma,Arial,sans-serif', "font-family:'Cairo',Tahoma,Arial,sans-serif");
          res.removeHeader('Content-Length');
          return originalEnd(enhanced, encoding, callback);
        }
      }
      return originalEnd(chunk, encoding, callback);
    };

    return listener(req, res);
  };
  return originalCreateServer(wrapped, ...args);
};

await import('./legacy-server.mjs');
