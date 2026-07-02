// Brand Splats — shared library core (zero dependencies)
// Used by both server.js (REST gateway) and mcp-server.js (agent gateway).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RIG_KEY = 'BS-DUB-01:demo-signing-key:v1'; // demo key — real system uses C2PA certs

function loadProducts() {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8');
  return JSON.parse(raw).products;
}

function loadSignatures() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'signatures.json'), 'utf8'));
  } catch (e) {
    return {};
  }
}

// Canonical JSON: sorted keys, no whitespace — so hashes are stable.
function canonical(obj) {
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  if (obj && typeof obj === 'object') {
    return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
  }
  return JSON.stringify(obj);
}

function signManifest(manifest) {
  return crypto.createHmac('sha256', RIG_KEY).update(canonical(manifest)).digest('hex');
}

function list() {
  return loadProducts().map(p => ({
    id: p.id, name: p.name, brand: p.brand, category: p.category,
    gtin: p.manifest.gtin, deltaE: p.manifest.qa.deltaE, qa: p.manifest.qa.status,
    verified: p.manifest.brand.verified, shape: p.shape, palette: p.palette,
    dimensions_mm: p.manifest.measured.dimensions_mm,
    primary_hex: p.manifest.measured.colour.primary_hex
  }));
}

function get(id) {
  return loadProducts().find(p => p.id === id) || null;
}

// --- search: token scoring + simple size/colour constraint parsing ---
const COLOUR_WORDS = {
  red: ['#c0392b'], orange: ['#e8622c'], amber: ['#b8792e'], gold: ['#b8792e', '#cfae6b'],
  black: ['#22252d', '#1a1a22'], graphite: ['#22252d'], dark: ['#22252d', '#1a1a22']
};

function search(query) {
  const q = (query || '').toLowerCase();
  const tokens = q.split(/[^a-z0-9#]+/).filter(Boolean);

  // constraint: "under 120mm", "shorter than 130 mm", "over 150mm"
  let maxH = null, minH = null;
  const under = q.match(/(?:under|below|less than|shorter than|max)\s+(\d+)\s*mm/);
  const over = q.match(/(?:over|above|more than|taller than|min)\s+(\d+)\s*mm/);
  if (under) maxH = parseInt(under[1], 10);
  if (over) minH = parseInt(over[1], 10);

  const results = loadProducts().map(p => {
    let score = 0;
    const hay = [p.name, p.brand, p.category, ...p.keywords].join(' ').toLowerCase();
    for (const t of tokens) {
      if (p.keywords.includes(t)) score += 3;
      else if (hay.includes(t)) score += 1;
      if (COLOUR_WORDS[t] && COLOUR_WORDS[t].some(c =>
        c.toLowerCase() === p.manifest.measured.colour.primary_hex.toLowerCase() ||
        c.toLowerCase() === p.palette.base.toLowerCase())) score += 3;
    }
    const h = p.manifest.measured.dimensions_mm[2];
    if (maxH !== null) { if (h <= maxH) score += 2; else score = -1; }
    if (minH !== null) { if (h >= minH) score += 2; else score = -1; }
    return { product: p, score, height_mm: h };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

  return results.map(r => ({
    id: r.product.id, name: r.product.name, brand: r.product.brand,
    category: r.product.category, gtin: r.product.manifest.gtin,
    height_mm: r.height_mm, deltaE: r.product.manifest.qa.deltaE,
    match_score: r.score
  }));
}

// --- verify: recompute HMAC of manifest, compare to signed record ---
function verify(id) {
  const p = get(id);
  if (!p) return { error: 'unknown asset', id };
  const sigs = loadSignatures();
  const stored = sigs[id];
  const computed = signManifest(p.manifest);
  const valid = !!stored && stored.signature === computed;
  return {
    id, asset: p.name,
    chain: [
      { step: 'capture_session', detail: p.manifest.measured.captureSession, ok: true },
      { step: 'qa_gate', detail: p.manifest.qa, ok: p.manifest.qa.status === 'PASS' },
      { step: 'manifest_hash', detail: { sha256_hmac: computed.slice(0, 32) + '…' }, ok: true },
      {
        step: 'signature_check',
        detail: {
          signed_at: stored ? stored.signed_at : null,
          signer: stored ? stored.signer : null,
          match: valid
        },
        ok: valid
      }
    ],
    status: valid ? 'VERIFIED' : 'TAMPER DETECTED — manifest does not match signed record',
    valid
  };
}

// --- licensing: machine-readable rights decisions ---
function license(id, useCase) {
  const p = get(id);
  if (!p) return { error: 'unknown asset', id };
  const lic = p.manifest.license;
  if (useCase === 'training' || useCase === 'model_training') {
    return {
      id, use_case: useCase, granted: false,
      reason: 'training: false — capture data is licensed for display and advertising only. The measured archive is not available as training data.',
      license: lic
    };
  }
  if (lic.usage.includes(useCase)) {
    return {
      id, use_case: useCase, granted: true,
      token: 'bsl_' + crypto.randomBytes(10).toString('hex'),
      territory: lic.territory, expires: lic.expires,
      conditions: p.manifest.brandRules
    };
  }
  return {
    id, use_case: useCase, granted: false,
    reason: `use case "${useCase}" is not covered by this asset's licence. Covered: ${lic.usage.join(', ')}.`,
    license: lic
  };
}

// --- rendition ladder descriptors ---
const RUNGS = {
  1: { label: 'Structured data', format: 'application/ld+json', consumers: 'every LLM agent' },
  2: { label: 'Hero still (relit on demand)', format: 'image/png', consumers: 'ads, feeds, agent thumbnails' },
  3: { label: 'Turntable video', format: 'video/mp4', consumers: 'listings, social, "show me" queries' },
  4: { label: 'Static splat / mesh proxy', format: 'model/gltf-binary', consumers: 'AR viewers, configurators' },
  5: { label: 'Relightable splat', format: 'model/gltf-binary + KHR_gaussian_splatting', consumers: 'creative platforms, Unreal, World Labs' }
};
const ENVS = ['studio', 'golden_hour', 'neon_night', 'forest'];

function rendition(id, rung, env) {
  const p = get(id);
  if (!p) return { error: 'unknown asset', id };
  rung = parseInt(rung, 10) || 2;
  if (!RUNGS[rung]) return { error: 'unknown rung; valid 1-5', rung };
  env = ENVS.includes(env) ? env : 'studio';
  const base = {
    id, rung, ...RUNGS[rung], lighting_env: (rung === 2 || rung === 5) ? env : null,
    uri: `/assets/${id}/r${rung}${rung === 2 ? '.' + env + '.png' : ''}`,
    derived_from: 'master relightable splat — no re-shoot',
    c2pa: 'embedded'
  };
  if (rung === 1) base.data = p.manifest;
  return base;
}

// --- semantic search via NVIDIA NIM (optional; falls back to keyword) ---
const nvidia = require('./nvidia');
let EMB_CACHE = null; // { docs: [vectors], ids: [...] }

async function searchSmart(query) {
  const kw = search(query);
  if (!nvidia.available()) return kw.map(r => ({ ...r, engine: 'keyword' }));
  try {
    const prods = loadProducts();
    if (!EMB_CACHE || EMB_CACHE.ids.join() !== prods.map(p => p.id).join()) {
      const docs = prods.map(p => [
        p.name, p.brand, p.category, p.keywords.join(' '),
        p.manifest.measured.materials.map(m => m.class + ' ' + m.finish).join(' ')
      ].join(' · '));
      EMB_CACHE = { ids: prods.map(p => p.id), docs: await nvidia.embed(docs, 'passage') };
    }
    const [qv] = await nvidia.embed([query], 'query');
    const scored = prods.map((p, i) => {
      const k = kw.find(x => x.id === p.id);
      const sem = nvidia.cosine(qv, EMB_CACHE.docs[i]);
      return {
        id: p.id, name: p.name, brand: p.brand, category: p.category,
        gtin: p.manifest.gtin, height_mm: p.manifest.measured.dimensions_mm[2],
        deltaE: p.manifest.qa.deltaE,
        match_score: +((k ? k.match_score : 0) + 8 * sem).toFixed(2),
        semantic: +sem.toFixed(3), engine: 'nvidia-nim:' + nvidia.MODEL
      };
    }).filter(r => r.semantic > 0.12 || kw.some(x => x.id === r.id))
      .sort((a, b) => b.match_score - a.match_score);
    return scored;
  } catch (e) {
    return kw.map(r => ({ ...r, engine: 'keyword (NIM unavailable: ' + e.message.slice(0, 60) + ')' }));
  }
}

// --- MCP-style tool surface (single source of truth) ---
const TOOL_DEFS = [
  {
    name: 'search_products',
    description: 'Search the Brand Splat Library by text query. Understands product type, colour, and size constraints like "under 120mm". Returns matching verified product assets with GTIN and QA scores.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'free-text search' } }, required: ['query'] }
  },
  {
    name: 'get_manifest',
    description: 'Get the signed Truth Manifest for an asset: GS1 identity, rig-measured dimensions/colour/materials, QA scores, brand rules and licence terms.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'get_rendition',
    description: 'Fetch an asset at a rung of the rendition ladder: 1=structured data, 2=hero still (choose lighting_env: studio|golden_hour|neon_night|forest), 3=turntable video, 4=static splat, 5=relightable splat.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, rung: { type: 'integer', minimum: 1, maximum: 5 }, lighting_env: { type: 'string' } }, required: ['id', 'rung'] }
  },
  {
    name: 'verify_asset',
    description: 'Cryptographically verify an asset: recomputes the manifest hash and checks it against the signed capture record (C2PA-style chain). Returns VERIFIED or TAMPER DETECTED.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'get_brand_rules',
    description: 'Get machine-readable brand governance for an asset: approved and excluded placement contexts, logo regions and minimum sizes. Check this before placing a product in a scene.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'request_license',
    description: 'Request a licence grant for a use case (advertising, agent_display, ar_commerce, training). Returns a grant token or a machine-readable refusal.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, use_case: { type: 'string' } }, required: ['id', 'use_case'] }
  }
];

async function callTool(name, args) {
  args = args || {};
  switch (name) {
    case 'search_products': return await searchSmart(args.query);
    case 'get_manifest': {
      const p = get(args.id);
      return p ? p.manifest : { error: 'unknown asset', id: args.id };
    }
    case 'get_rendition': return rendition(args.id, args.rung, args.lighting_env);
    case 'verify_asset': return verify(args.id);
    case 'get_brand_rules': {
      const p = get(args.id);
      return p ? { id: args.id, brandRules: p.manifest.brandRules } : { error: 'unknown asset', id: args.id };
    }
    case 'request_license': return license(args.id, args.use_case);
    default: return { error: 'unknown tool: ' + name };
  }
}

module.exports = { list, get, search, searchSmart, verify, license, rendition, signManifest, canonical, TOOL_DEFS, ENVS, RUNGS, callTool, DATA_DIR };
