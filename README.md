# Brand Splats — Platform Prototype

**Scan once. Create forever.** Working prototype of the Brand Splat platform: a library of
verified, rig-measured product assets with signed Truth Manifests, a rendition ladder,
an agent gateway (REST + real MCP), machine-readable brand governance and licensing.

Zero dependencies — just Node (v18+).

## Run it

```bash
cd brand-splats-platform
node server.js
```

Open **http://localhost:4747**

## What to demo (in order)

1. **Library** — four captured demo products. Click one: drag the splat, switch lighting
   environments (relightable, rung 5), walk down the rendition ladder to hero stills,
   turntable, and raw structured data.
2. **Verify provenance** — in a product sheet, hit *Verify provenance*. The server
   recomputes the manifest hash and checks it against the signed capture record.
   Try it: edit any number in `data/products.json`, restart, verify again → **TAMPER DETECTED**.
   Re-sign with `node scripts/sign.js` and it's green again. That's the notary working.
3. **Request licence** — choose `training` → machine-readable refusal. The data moat, legible to agents.
4. **Agent Console** — type or click a suggestion. Every answer shows the real tool
   calls hitting the gateway: search → manifest → verify → relit rendition. Try
   the cocktail-bar question: the agent declines because brand governance travels with the asset.
5. **Gateway** — the REST endpoints and the MCP tool surface, with curl examples.

## Plug it into Claude (the killer demo)

`mcp-server.js` is a real MCP server over stdio. Add to Claude Desktop / Cowork config:

```json
{
  "mcpServers": {
    "brand-splats": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/brand-splats-platform/mcp-server.js"]
    }
  }
}
```

Then ask Claude: *"Search the brand splats library for a red can, verify it, and tell me
its measured colour."* Claude will use `search_products`, `verify_asset` and
`get_manifest` — live, against your library.

## Splat Lab — load real Gaussian splats

Open **http://localhost:4747/splat-lab.html** (or the *Splat Lab* nav button).
Loads real `.splat` / `.ply` / `.ksplat` files via the GaussianSplats3D (three.js) renderer:

- One-click free samples from [cakewalk/splat-data](https://huggingface.co/cakewalk/splat-data)
  on Hugging Face — including a real product splat of a trainer (research-licensed, test only).
- Drag-and-drop any splat file, load from URL, or drop files into `data/splats/`
  and they appear as local library buttons.
- To make your own: scan a product with **Polycam** or **Luma AI** (both export
  Gaussian splats free), export `.ply`/`.splat`, drop it in.

## NVIDIA API (optional) — semantic search

With your NVIDIA (Inception / build.nvidia.com) API key, library search upgrades from
keyword matching to NIM embedding-based semantic search — agents can find "something
premium for an evening fragrance campaign" instead of exact words:

```bash
export NVIDIA_API_KEY=nvapi-xxxx
node server.js
```

Search results then carry `"engine": "nvidia-nim:nvidia/nv-embedqa-e5-v5"` and a
`semantic` score. No key → automatic keyword fallback. (Adapter: `lib/nvidia.js`;
same slot later serves NIM-hosted relighting models and USD tooling.)

## Layout

```
server.js          web app + REST gateway (port 4747)
mcp-server.js      real MCP server (stdio) — same tool surface
lib/store.js       library core: search, manifests, signing, licensing, tools
lib/nvidia.js      NVIDIA NIM adapter (semantic search embeddings)
data/products.json four demo products with full Truth Manifests
data/signatures.json  signed manifest hashes (the notary record)
data/splats/       drop real .splat/.ply files here → Splat Lab picks them up
scripts/sign.js    re-sign manifests after edits
public/            frontend (library, splat viewer, agent console, gateway, splat lab)
```

## What's real vs. mocked

Real: the tool surface, search with size/colour constraints, JSON-LD Truth Manifests,
HMAC signing + tamper detection, licence decisions, brand-rule enforcement, MCP protocol.
Mocked: the splats themselves (procedural point clouds standing in for 3DGS), hero
renders (vector stand-ins for relit output), C2PA (HMAC in place of cert-chain signing).
The mocks sit exactly where WP1's capture-to-relight pipeline plugs in.
