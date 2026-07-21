// Vercel 서버리스 함수 — 모든 /api/* 요청을 공용 라우터로 위임한다.
// (로컬 개발은 server.js 가 동일한 routeApi 를 사용)
import { routeApi } from '../src/router.js';

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  try {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `http://${host}`);
    const method = req.method || 'GET';
    const query = Object.fromEntries(url.searchParams.entries());

    let body = {};
    if (method === 'POST') {
      // Vercel may pre-parse JSON into req.body; otherwise read the stream.
      if (req.body && typeof req.body === 'object') body = req.body;
      else if (typeof req.body === 'string') {
        try {
          body = JSON.parse(req.body);
        } catch {
          body = {};
        }
      } else {
        body = await readJson(req);
      }
    }

    const { status, body: out } = routeApi({ method, pathname: url.pathname, query, body });
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.statusCode = status;
    res.end(JSON.stringify(out));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: '서버 오류', detail: String(err && err.message) }));
  }
}
