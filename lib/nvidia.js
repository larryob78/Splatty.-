// NVIDIA NIM adapter — semantic embeddings for library search.
// Uses your NVIDIA API key (Inception / build.nvidia.com):
//   export NVIDIA_API_KEY=nvapi-...   then restart server.js
// Without a key, the platform falls back to keyword search automatically.
'use strict';

const ENDPOINT = process.env.NVIDIA_EMBED_URL || 'https://integrate.api.nvidia.com/v1/embeddings';
const MODEL = process.env.NVIDIA_EMBED_MODEL || 'nvidia/nv-embedqa-e5-v5';

function available() { return !!process.env.NVIDIA_API_KEY; }

async function embed(texts, inputType) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.NVIDIA_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      input: texts,
      input_type: inputType,        // 'query' | 'passage'
      encoding_format: 'float',
      truncate: 'END'
    })
  });
  if (!r.ok) throw new Error('NIM ' + r.status + ': ' + (await r.text()).slice(0, 140));
  const d = await r.json();
  return d.data.sort((a, b) => a.index - b.index).map(x => x.embedding);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

module.exports = { available, embed, cosine, MODEL };
