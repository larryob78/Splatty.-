// Brand Splats — ingest a real Gaussian splat (.splat format) into the library.
//
//   node scripts/ingest.js data/splats/nike.splat "Trainer (HF test capture)" trainer-hf
//
// Parses the 32-byte-per-gaussian .splat format (antimatter15 layout:
// float32 x,y,z · float32 sx,sy,sz · uint8 rgba · uint8 quaternion),
// MEASURES the capture (count, bounding box, opacity-weighted colour),
// generates a Truth Manifest, flags missing calibration, samples a preview
// point cloud for the library viewer, signs the manifest, done.
'use strict';
const fs = require('fs');
const path = require('path');
const store = require('../lib/store');

const [, , fileArg, nameArg, idArg] = process.argv;
if (!fileArg) { console.error('usage: node scripts/ingest.js <file.splat> [display name] [id]'); process.exit(1); }

const file = path.resolve(fileArg);
const buf = fs.readFileSync(file);
if (buf.length % 32 !== 0) { console.error('not a valid .splat file (length not divisible by 32)'); process.exit(1); }
const n = buf.length / 32;

// ---- measure ----
let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
let cw = [0, 0, 0], wsum = 0;
for (let i = 0; i < n; i++) {
  const o = i * 32;
  const x = buf.readFloatLE(o), y = buf.readFloatLE(o + 4), z = buf.readFloatLE(o + 8);
  const r = buf[o + 24], g = buf[o + 25], b = buf[o + 26], a = buf[o + 27] / 255;
  if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
  if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
  if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
  cw[0] += r * a; cw[1] += g * a; cw[2] += b * a; wsum += a;
}
const dims = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
const rgb = cw.map(v => Math.round(v / (wsum || 1)));
const hex = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

// sRGB → CIE Lab (D65)
function toLab([r, g, b]) {
  const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const t = v => v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + 16 / 116;
  [X, Y, Z] = [t(X), t(Y), t(Z)];
  return [+(116 * Y - 16).toFixed(1), +(500 * (X - Y)).toFixed(1), +(200 * (Y - Z)).toFixed(1)];
}
const lab = toLab(rgb);

// ---- sample preview point cloud for the library viewer ----
const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
const radius = Math.max(dims[0], dims[1], dims[2]) / 2 || 1;
const scale = 120 / radius;
const TARGET = 3200;
const step = Math.max(1, Math.floor(n / (TARGET * 3)));
const pts = [];
for (let i = 0; i < n && pts.length < TARGET; i += step) {
  const o = i * 32;
  const a = buf[o + 27];
  if (a < 60) continue; // skip near-transparent gaussians
  pts.push({
    x: +(((buf.readFloatLE(o) - center[0]) * scale)).toFixed(1),
    y: +((-(buf.readFloatLE(o + 4) - center[1]) * scale)).toFixed(1),  // splat y-down → viewer y-up
    z: +(((buf.readFloatLE(o + 8) - center[2]) * scale)).toFixed(1),
    c: [buf[o + 24], buf[o + 25], buf[o + 26]],
    s: 1
  });
}

// ---- build product + Truth Manifest ----
const id = idArg || path.basename(file).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
const name = nameArg || path.basename(file);
const today = new Date().toISOString().slice(0, 10);

const product = {
  id, name,
  brand: 'Third-party capture (uncalibrated)',
  category: 'ingested splat',
  keywords: ['ingested', 'real', 'splat', 'test', ...name.toLowerCase().split(/\s+/)],
  shape: 'cloud',
  palette: { base: hex, accent: '#c8ff3d', metal: '#9aa0ae' },
  points_url: '/points/' + id + '.json',
  splat_file: '/splats/' + path.basename(file),
  manifest: {
    '@context': ['https://schema.org', 'https://brandsplats.io/truth/v1'],
    '@type': 'Product3DAsset',
    gtin: null, sku: 'INGEST-' + id.toUpperCase(),
    name,
    brand: { '@type': 'Brand', name: 'unverified third-party capture', verified: false },
    measured: {
      gaussian_count: n,
      dimensions_scene_units: dims.map(d => +d.toFixed(3)),
      dimensions_mm: null,
      scale_calibration: 'MISSING — capture was not made on a calibrated rig; physical dimensions unrecoverable',
      colour: { primary_hex: hex, primary_lab: lab, deltaE_vs_brand_spec: null, note: 'opacity-weighted mean of ' + n + ' gaussians; no colour target in capture' },
      materials: [{ region: 'all', class: 'unknown', finish: 'unknown', relight_track: 'none — no polarised passes, not relightable' }],
      captureSession: { rig_id: 'EXTERNAL', date: today, passes: ['single RGB (uncontrolled)'], calibration_cert: null, source_file: path.basename(file), source_bytes: buf.length }
    },
    qa: { deltaE: null, geometry_dev_mm: null, logo_integrity: null, status: 'PROVISIONAL — fails Brand Splats QA: no calibration, no colour target, no relight data' },
    brandRules: { logo_regions: [], approved_contexts: ['test'], excluded_contexts: ['advertising'] },
    license: { usage: ['agent_display'], training: false, territory: 'test only — research-licensed source', expires: today },
    renditions: [1, 4]
  }
};

// ---- write everything ----
const ROOT = path.join(__dirname, '..');
fs.mkdirSync(path.join(ROOT, 'public', 'points'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public', 'points', id + '.json'), JSON.stringify(pts));

const dataPath = path.join(ROOT, 'data', 'products.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
data.products = data.products.filter(p => p.id !== id);
data.products.push(product);
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

// sign
const sigPath = path.join(ROOT, 'data', 'signatures.json');
let sigs = {}; try { sigs = JSON.parse(fs.readFileSync(sigPath, 'utf8')); } catch (e) {}
sigs[id] = { signature: store.signManifest(product.manifest), signed_at: new Date().toISOString(), signer: 'ingest pipeline (demo)' };
fs.writeFileSync(sigPath, JSON.stringify(sigs, null, 2));

console.log('── INGEST REPORT ─────────────────────────────');
console.log('file          ', path.basename(file), '(' + (buf.length / 1e6).toFixed(1) + ' MB)');
console.log('gaussians     ', n.toLocaleString());
console.log('bbox (scene)  ', dims.map(d => d.toFixed(2)).join(' × '));
console.log('dominant col  ', hex, '· Lab', lab.join(', '));
console.log('QA verdict    ', product.manifest.qa.status);
console.log('preview points', pts.length, '→ public/points/' + id + '.json');
console.log('manifest      ', 'signed ✓ → library id "' + id + '"');
console.log('──────────────────────────────────────────────');
