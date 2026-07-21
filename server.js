// PlayPass MVP server — zero external dependencies.
// Serves the static SPA (public/) and a small JSON REST API (/api/*).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { routeApi } from './src/router.js';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, 'public');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy(); // basic guard
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

async function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  // prevent path traversal
  const filePath = normalize(join(publicDir, rel));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) throw new Error('dir');
    const buf = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    // SPA fallback for unknown non-file routes
    if (!extname(filePath)) {
      const buf = await readFile(join(publicDir, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'] });
      return res.end(buf);
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;
  const query = Object.fromEntries(searchParams.entries());
  const method = req.method;
  try {
    const body = method === 'POST' ? await readBody(req) : {};
    const { status, body: out } = routeApi({ method, pathname, query, body });
    return sendJson(res, status, out);
  } catch (err) {
    return sendJson(res, 500, { error: '서버 오류', detail: String(err && err.message) });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url);
  }
  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`\n🏃 PlayPass MVP 서버 실행 중`);
  console.log(`   사용자 앱   → http://localhost:${PORT}/`);
  console.log(`   파트너 앱   → http://localhost:${PORT}/partner.html\n`);
});
