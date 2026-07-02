# Brand Splats — The Agent Platform Layer
*How the capture pipeline becomes a system agents actually use · July 2026*

---

## The core insight

The EI proposal proves the hard science: relightable, brand-accurate capture. But a splat alone is just pixels — agents can't trust pixels. What agents need is **verifiable claims attached to assets**. The crack is this:

> **Your calibrated capture rig doesn't just make images. It makes *measurements*. Measurements can be signed. Signed measurements are the only product data an agent can trust without a human in the loop.**

Nobody else can make this claim. Polycam can't (uncalibrated phone capture). Generative platforms can't (they hallucinate products). Retail feeds can't (marketing copy, not measurement). The rig's calibration discipline — colour targets, scale targets, fixed world origin — is already in the proposal for reconstruction quality. Reused as a *data provenance* story, it becomes the platform.

**One sentence:** Brand Splats is the notary between physical products and the agent economy.

---

## The system: four layers

### Layer 1 — Capture OS (the factory) · *already designed in the EI proposal*
Calibrated multi-pass polarised capture → raw archive with every frame + light/camera metadata. Nothing to add except: log the calibration certificates per session. They become the evidence chain Layer 3 signs.

### Layer 2 — Asset Foundry (the refinery) · *already designed*
3DGS reconstruction → two-track relighting → brand QA gate (ΔE ≤ 1.5). One addition: the QA gate shouldn't just pass/fail — it should **emit its scores as data** (measured ΔE, geometric deviation, logo-region integrity). Those scores go straight into the manifest. QA output = metadata input.

### Layer 3 — The Brand Splat Package (the sellable unit) · *THE THING TO CRACK*

A Brand Splat is not a file. It's a **container** with four parts:

**1. Splat core** — 3DGS in glTF via `KHR_gaussian_splatting` (Khronos announced Feb 2026, ratification ~Q2 2026 — your timing is perfect), plus USD and Unreal exports. Keep format-agnostic; the platform relationships tell you where standardisation lands.

**2. Rendition ladder** — the pragmatic unlock most people miss. In 2026 almost no shopping agent renders 3D. They consume text and images. So every package auto-generates a descending ladder:

| Rung | Asset | Who uses it |
|---|---|---|
| 5 | Relightable splat | Creative platforms, Unreal, World Labs |
| 4 | Static splat / mesh proxy | AR viewers, product configurators |
| 3 | Turntable video | Listings, social, agent "show me" queries |
| 2 | Hero stills (any lighting, on demand) | Ads, feeds, agent thumbnails |
| 1 | Text + structured data | Every LLM agent, today |

The splat is the master; everything below is derived automatically. This means **Brand Splats is useful to agents on day one**, before any agent can render a splat — and gets more valuable as agents climb the ladder.

**3. The Truth Manifest** — a signed JSON-LD sidecar. This is the metadata scheme you asked about. Three tiers of claims, in decreasing order of verifiability:

```jsonc
{
  "@context": ["https://schema.org", "https://brandsplats.io/truth/v1"],
  "@type": "Product3DAsset",

  // TIER 1 — IDENTITY (links to existing commerce rails)
  "gtin": "05012345678900",            // GS1 barcode ID — what every
  "sku": "NB-CAN-330-2026",            // retail & agent system keys on
  "brand": { "@type": "Brand", "name": "…", "verified": true },

  // TIER 2 — MEASURED TRUTH (the unforgeable part; from the rig)
  "measured": {
    "dimensions_mm": [66.2, 66.2, 115.1],   // from calibrated scale target
    "colour": {
      "primary_lab": [53.1, 78.9, 62.4],     // measured, not brand-book
      "deltaE_vs_brand_spec": 0.8            // QA gate output
    },
    "materials": [{ "region": "body", "class": "aluminium",
                    "brdf_ref": "brdf/body.bin" }],  // from decomposition
    "captureSession": {
      "rig_id": "BS-DUB-01", "date": "2026-07-02",
      "calibration_cert": "cal/2026-07-02.json"
    }
  },

  // TIER 3 — CREATIVE & USAGE SEMANTICS (what creative agents need)
  "brandRules": {
    "logo_regions": [{ "mesh_region": "front_label", "min_px": 120 }],
    "approved_contexts": ["lifestyle", "product_hero"],
    "excluded_contexts": ["alcohol_adjacent", "political"]
  },
  "license": {
    "usage": ["advertising", "agent_display", "ar_commerce"],
    "training": false,                  // your data-moat clause, machine-readable
    "expires": "2027-07-02"
  },
  "embeddings": { "clip": "emb/clip.bin" }   // semantic search for agents
}
```

Design principles: **Tier 1 borrows existing standards** (schema.org + GS1 GTIN — agents already speak these; don't invent an identity system). **Tier 2 is your invention** — nobody else has measured data to put there. **Tier 3 makes brand governance machine-readable** — a creative agent placing the product in a scene can *read the brand guidelines* instead of guessing.

**4. C2PA seal** — sign the whole package with Content Credentials (spec v2.4, Apr 2026). This does three jobs at once: (a) agents verify assets cryptographically before showing them to buyers; (b) when agent A hands the asset to agent B, the claims travel with it tamper-evident — this is exactly your "agents bring information back to other agents" requirement; (c) EU AI Act Article 50 transparency lands **August 2026** — signed provenance built in becomes a compliance feature you can sell, not a burden.

### Layer 4 — Agent Gateway (the distribution) · *the second thing to crack*

Three doors, matching the three consumer types:

**Door 1 — the Brand Splat Library MCP server.** MCP is how agents consume catalogues now: Shopify ships four MCP servers per store by default, Akeneo (PIM) launched theirs Jan 2026, Microsoft Dynamics 365 Commerce added one June 2026. The library exposes roughly six tools:

- `search_products(query | embedding | gtin)` — find assets
- `get_manifest(id)` — the truth manifest
- `get_rendition(id, rung, lighting_env?)` — fetch at the level the agent can use; **relit-on-demand hero shots are the killer tool** (agent supplies scene HDRI, gets back the product correctly lit for that scene)
- `verify(id)` — check the C2PA chain
- `get_brand_rules(id)` — usage constraints for creative placement
- `request_license(id, use_case)` — the monetisation hook

**Door 2 — ACP product feeds.** The OpenAI/Stripe/Meta Agentic Commerce Protocol product feed spec already includes a **3D model field**. A "Brand Splats Connect" export pushes rung 1–3 renditions + manifest data into merchants' existing feeds (Shopify apps, Akeneo PIM plugin). This puts splats inside ChatGPT Instant Checkout / eBay / marketplace surfaces without those platforms adopting anything new.

**Door 3 — Creative SDK.** Plugins/adapters for Runway, World Labs, Luma, Unreal, Nuke: "insert verified product here." The platform relationships in the proposal are exactly this door.

---

## The flywheel (why this compounds)

Every capture → richer library → more agent queries → usage data (which lighting environments, which contexts, which renditions agents actually request) → better QA models and reprocessed archives (no re-shoot) → training data nobody can scrape (the `training: false` licence flag makes the moat *legally legible* to agents). The archive already in the proposal is the flywheel's fuel tank; the gateway is its crank.

---

## Build order (deliberately cheap where the proposal is expensive)

The EI grant funds the hard physics (Layers 1–2). Layers 3–4 are **pure software, buildable now, and stay Brand Splats background IP** — they don't touch the Trinity foreground-IP scope.

1. **Now (pre-grant, weeks):** Truth Manifest v0.1 schema + a reference MCP server over 3–5 demo splats (captured with existing tools — quality doesn't matter yet, the *interface* does). Demo: ask Claude/ChatGPT to find a product, check its measured colour, and fetch a hero render. That demo in front of an agency sells the whole vision.
2. **Months 1–6 (parallel to WP1):** rendition ladder automation; C2PA signing; ACP feed exporter prototype.
3. **Months 6–12 (as WP1 matures):** wire the QA gate scores into manifests; relit-on-demand rendition service; first creative-platform adapter via the Runway/World Labs relationships.
4. **Post-PoC:** licensing API, brand-verified registry, PIM integrations (Akeneo pattern).

**Also worth adding to the EI narrative:** the proposal currently says "structured for machines" without saying how. One paragraph naming the Truth Manifest + MCP gateway (as background IP, no grant cost) makes the "agent-ready" claim concrete and answers the obvious assessor question.

---

## What could kill it (watch these)

- **Format churn** — mitigated by the rendition ladder (rungs 1–3 are format-proof) and the platform relationships.
- **Platforms verticalise** — if OpenAI/Google build first-party product capture, your defence is the measured-truth layer and brand trust, not the splat itself. Keep the notary framing central.
- **Agents skip 3D entirely** — the ladder means you win anyway: rung 1–2 (verified data + on-demand stills) is already better than anything agents have today.
- **Metadata standard emerges without you** — join early: GS1, Khronos 3D Commerce working group, C2PA. Cheap insurance; being *in the room* is the same play as the NVIDIA/Runway relationships.

---

*Sources: OpenAI/Stripe ACP product-feed spec (3D model support, developers.openai.com/commerce), Khronos KHR_gaussian_splatting announcement (Feb 2026, ratification ~Q2 2026), C2PA spec v2.4 (Apr 2026) + EU AI Act Art. 50 (Aug 2026), Shopify/Akeneo/Dynamics 365 MCP commerce rollouts (2026).*
