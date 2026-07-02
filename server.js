// Brand Splats — platform prototype server (zero dependencies)
// Run: node server.js  →  http://localhost:4747
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const store = require('./lib/store');

const PORT = process.env.PORT || 4747;
const PUB = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

function json(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;

  // ---------- Agent Gateway (REST mirror of the MCP tool surface) ----------
  if (p === '/api/products' && req.method === 'GET') {
    const q = u.searchParams.get('q');
    return json(res, 200, q ? await store.searchSmart(q) : store.list());
  }
  let m;
  if ((m = p.match(/^\/api\/products\/([\w-]+)\/manifest$/)) && req.method === 'GET') {
    const prod = store.get(m[1]);
    return prod ? json(res, 200, prod.manifest) : json(res, 404, { error: 'unknown asset' });
  }
  if ((m = p.match(/^\/api\/products\/([\w-]+)\/rendition$/)) && req.method === 'GET') {
    return json(res, 200, store.rendition(m[1], u.searchParams.get('rung') || 2, u.searchParams.get('env')));
  }
  if ((m = p.match(/^\/api\/products\/([\w-]+)\/verify$/)) && req.method === 'GET') {
    return json(res, 200, store.verify(m[1]));
  }
  if ((m = p.match(/^\/api\/products\/([\w-]+)\/rules$/)) && req.method === 'GET') {
    const prod = store.get(m[1]);
    return prod ? json(res, 200, { id: m[1], brandRules: prod.manifest.brandRules }) : json(res, 404, { error: 'unknown asset' });
  }
  if ((m = p.match(/^\/api\/products\/([\w-]+)\/license$/)) && req.method === 'POST') {
    const body = await readBody(req);
    return json(res, 200, store.license(m[1], body.use_case || 'advertising'));
  }
  if (p === '/api/mcp' && req.method === 'GET') {
    return json(res, 200, {
      server: 'brand-splats-library', version: '0.1.0',
      note: 'This REST API mirrors the MCP tool surface. For real agent access, run mcp-server.js over stdio (see README).',
      tools: store.TOOL_DEFS
    });
  }
  // generic tool-call endpoint (lets the frontend agent console use the exact tool surface)
  if (p === '/api/tool' && req.method === 'POST') {
    const body = await readBody(req);
    return json(res, 200, { tool: body.name, result: await store.callTool(body.name, body.args) });
  }

  // ---------- real splat files (Splat Lab) ----------
  const SPLATS_DIR = path.join(__dirname, 'data', 'splats');
  if (p === '/splats/list' && req.method === 'GET') {
    let files = [];
    try { files = fs.readdirSync(SPLATS_DIR).filter(f => /\.(splat|ply|ksplat|spz)$/i.test(f)); } catch (e) {}
    return json(res, 200, files.map(f => ({ name: f, url: '/splats/' + encodeURIComponent(f) })));
  }
  if (p.startsWith('/splats/') && req.method === 'GET') {
    const f = path.join(SPLATS_DIR, decodeURIComponent(p.slice(8)));
    if (f.startsWith(SPLATS_DIR) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': fs.statSync(f).size });
      return fs.createReadStream(f).pipe(res);
    }
    return json(res, 404, { error: 'splat not found' });
  }

  // ---------- static frontend ----------
  let file = p === '/' ? '/index.html' : p;
  file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
  const full = path.join(PUB, file);
  if (full.startsWith(PUB) && fs.existsSync(full) && fs.statSync(full).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    return fs.createReadStream(full).pipe(res);
  }
  json(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  BRAND SPLATS — platform prototype');
  console.log('  Scan once. Create forever.');
  console.log('');
  console.log(`  App:          http://localhost:${PORT}`);
  console.log(`  Gateway API:  http://localhost:${PORT}/api/mcp`);
  console.log('');
});
