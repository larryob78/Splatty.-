// SOG → .splat converter (SuperSplat/PlayCanvas compressed format → antimatter15 .splat)
// Usage: node scripts/sog-to-splat.js <dir-with-meta.json+webps> <out.splat>
// Needs `sharp` for WebP decode:  npm i sharp   (or set SHARP_PATH)
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.SHARP_PATH || 'sharp');

const [, , dirArg, outArg] = process.argv;
if (!dirArg || !outArg) { console.error('usage: node scripts/sog-to-splat.js <sog-dir> <out.splat>'); process.exit(1); }
const dir = path.resolve(dirArg);

async function img(name) {
  const f = path.join(dir, name);
  if (!fs.existsSync(f)) return null;
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const SH_C0 = 0.28209479177387814;
const sigmoid = x => 1 / (1 + Math.exp(-x));
const clamp255 = v => Math.max(0, Math.min(255, Math.round(v)));

(async () => {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  console.log('meta keys:', Object.keys(meta).join(', '));

  const meansL = await img('means_l.webp');
  const meansU = await img('means_u.webp');
  const quats = await img('quats.webp');
  const scales = await img('scales.webp');
  const sh0 = await img('sh0.webp');

  const count = meta.count || meta.means.shape?.[0] || (meansL.w * meansL.h);
  const W = meansL.w;
  console.log('gaussians:', count, 'grid:', meansL.w + 'x' + meansL.h);

  // attribute metadata (sogs v2: mins/maxs for means, codebooks for scales/sh0)
  const mMins = meta.means.mins, mMaxs = meta.means.maxs;
  const scaleBook = meta.scales.codebook || null;
  const sMins = meta.scales.mins, sMaxs = meta.scales.maxs;
  const sh0Book = meta.sh0.codebook || null;
  const cMins = meta.sh0.mins, cMaxs = meta.sh0.maxs;

  const out = Buffer.alloc(count * 32);
  for (let i = 0; i < count; i++) {
    const px = i * 4;
    const o = i * 32;

    // --- position: 16-bit fixed → lerp(mins,maxs) → inverse log transform ---
    for (let c = 0; c < 3; c++) {
      const u16 = (meansU.data[px + c] << 8) | meansL.data[px + c];
      const n = u16 / 65535;
      const v = mMins[c] + (mMaxs[c] - mMins[c]) * n;
      const posv = Math.sign(v) * (Math.exp(Math.abs(v)) - 1);
      out.writeFloatLE(posv, o + c * 4);
    }

    // --- scales: codebook (log-space) or min/max range ---
    for (let c = 0; c < 3; c++) {
      const idx = scales.data[px + c];
      let lg;
      if (scaleBook) lg = scaleBook[idx];
      else lg = sMins[c % sMins.length] + (sMaxs[c % sMaxs.length] - sMins[c % sMins.length]) * (idx / 255);
      out.writeFloatLE(Math.exp(lg), o + 12 + c * 4);
    }

    // --- colour + opacity from sh0 (DC spherical harmonics) ---
    const dc = [];
    for (let c = 0; c < 3; c++) {
      const idx = sh0.data[px + c];
      let v;
      if (sh0Book) v = sh0Book[idx];
      else v = cMins[c] + (cMaxs[c] - cMins[c]) * (idx / 255);
      dc.push(v);
    }
    let opacity;
    {
      const idx = sh0.data[px + 3];
      let v;
      if (sh0Book) v = sh0Book[idx];
      else v = (cMins[3] !== undefined) ? cMins[3] + (cMaxs[3] - cMins[3]) * (idx / 255) : (idx / 255);
      opacity = sigmoid(v);
    }
    out[o + 24] = clamp255((0.5 + SH_C0 * dc[0]) * 255);
    out[o + 25] = clamp255((0.5 + SH_C0 * dc[1]) * 255);
    out[o + 26] = clamp255((0.5 + SH_C0 * dc[2]) * 255);
    out[o + 27] = clamp255(opacity * 255);

    // --- rotation: 3 packed components + reconstructed largest (alpha = 252+mode) ---
    {
      const mode = quats.data[px + 3] - 252;   // which component is largest
      const SQRT2 = Math.SQRT2;
      const a = (quats.data[px] / 255 - 0.5) * SQRT2;
      const b = (quats.data[px + 1] / 255 - 0.5) * SQRT2;
      const c2 = (quats.data[px + 2] / 255 - 0.5) * SQRT2;
      const d = Math.sqrt(Math.max(0, 1 - (a * a + b * b + c2 * c2)));
      // insert largest back at position `mode`; sogs order is (x,y,z,w) rotated
      const comps = [a, b, c2];
      comps.splice(mode >= 0 && mode <= 3 ? mode : 3, 0, d);
      // .splat rotation byte order: (w,x,y,z) — sogs stores (x,y,z,w) with mode index
      const [x, y, z, w] = comps;
      const q = [w, x, y, z];
      const norm = Math.hypot(...q) || 1;
      for (let c = 0; c < 4; c++) out[o + 28 + c] = clamp255((q[c] / norm) * 128 + 128);
    }
  }

  fs.writeFileSync(outArg, out);
  console.log('wrote', outArg, (out.length / 1e6).toFixed(1) + ' MB,', count, 'gaussians');
  console.log('note: higher-order SH (shN) dropped — .splat format carries DC colour only');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
