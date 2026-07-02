// Regenerate data/signatures.json — the "notary" step.
// Run after any manifest change: node scripts/sign.js
// If a manifest is edited WITHOUT re-signing, /verify reports TAMPER DETECTED.
'use strict';
const fs = require('fs');
const path = require('path');
const store = require('../lib/store');

const products = JSON.parse(fs.readFileSync(path.join(store.DATA_DIR, 'products.json'), 'utf8')).products;
const out = {};
for (const p of products) {
  out[p.id] = {
    signature: store.signManifest(p.manifest),
    signed_at: new Date().toISOString(),
    signer: 'BS-DUB-01 rig authority (demo)'
  };
}
fs.writeFileSync(path.join(store.DATA_DIR, 'signatures.json'), JSON.stringify(out, null, 2));
console.log('signed ' + products.length + ' manifests → data/signatures.json');
