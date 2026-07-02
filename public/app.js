/* Brand Splats — platform prototype frontend */
'use strict';

// ---------------------------------------------------------------- api
const api = {
  list: () => fetch('/api/products').then(r => r.json()),
  tool: (name, args) => fetch('/api/tool', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, args })
  }).then(r => r.json()).then(d => d.result),
  mcp: () => fetch('/api/mcp').then(r => r.json())
};

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const hexRGB = h => { h = h.replace('#', ''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; };
const jitter = (c, n) => c.map(v => Math.max(0, Math.min(255, v + (Math.random()-0.5)*n)));

// ------------------------------------------------- point cloud shapes
function genPoints(shape, palette) {
  const P = [];
  const base = hexRGB(palette.base), accent = hexRGB(palette.accent), metal = hexRGB(palette.metal);
  const push = (x,y,z,c,s=1) => P.push({x,y,z,c:jitter(c,26),s});

  if (shape === 'can') {
    const r=42, h=140;
    for (let i=0;i<2100;i++){ const t=Math.random()*Math.PI*2, y=Math.random()*h-h/2;
      const label = y>-46 && y<38;
      push(r*Math.cos(t), y, r*Math.sin(t), label?base:metal);
    }
    for (let i=0;i<260;i++){ const t=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random())*(r-4);
      push(rr*Math.cos(t), h/2, rr*Math.sin(t), metal); }
    for (let i=0;i<160;i++){ const t=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random())*(r-6);
      push(rr*Math.cos(t), -h/2, rr*Math.sin(t), metal); }
    for (let i=0;i<180;i++){ const t=Math.random()*Math.PI*2; // accent stripe
      push(43*Math.cos(t), 44+Math.random()*6, 43*Math.sin(t), accent); }
  }

  if (shape === 'perfume') {
    const w=46, d=22, h=104, y0=-64;
    for (let i=0;i<2200;i++){
      const face = Math.random();
      const y = y0 + Math.random()*h;
      const depth = (y-y0)/h; // lighter toward top
      const liquid = [base[0]*(0.55+0.5*depth), base[1]*(0.5+0.5*depth), base[2]*(0.45+0.5*depth)];
      if (face < 0.36) push((Math.random()<0.5?-w:w), y, (Math.random()*2-1)*d, liquid);       // sides x
      else if (face < 0.72) push((Math.random()*2-1)*w, y, (Math.random()<0.5?-d:d), liquid);  // sides z
      else push((Math.random()*2-1)*w, y, (Math.random()*2-1)*d, jitter(liquid, 60), 0.7);     // inner shimmer
    }
    for (let i=0;i<420;i++){ const t=Math.random()*Math.PI*2, rr=15, y=40+Math.random()*30;   // cap
      push(rr*Math.cos(t), y, rr*Math.sin(t)*0.8, metal); }
    for (let i=0;i<130;i++) push((Math.random()*2-1)*w, 40, (Math.random()*2-1)*d, metal, 0.8); // shoulder
  }

  if (shape === 'sneaker') {
    const L=190;
    const half = x => 34*Math.sqrt(Math.max(0.05, 1-Math.pow(x/(L*0.62),2)));
    const topY = x => x<-30 ? 58*Math.sqrt(Math.max(0,1-Math.pow((x+30)/95,2))) : 34*Math.sqrt(Math.max(0.05,1-Math.pow((x+10)/130,2)));
    const soleY = x => -34 + (x>40 ? (x-40)*0.16 : 0); // toe spring
    for (let i=0;i<2600;i++){
      const x = (Math.random()*2-1)*L*0.62;
      const w = half(x);
      if (Math.random()<0.34){ // sole band
        const y = soleY(x) + Math.random()*14;
        push(x, y, (Math.random()*2-1)*w, Math.random()<0.85?metal:accent);
      } else { // upper shell
        const t = Math.random()*Math.PI; // half ellipse over z
        const yTop = topY(x);
        const y = soleY(x)+14 + Math.sin(t)*Math.max(6,yTop);
        const z = Math.cos(t)*w*0.92;
        const lace = Math.abs(z)<7 && x>-45 && x<45;
        push(x, y, z, lace?accent:(Math.random()<0.12?accent:base));
      }
    }
  }

  if (shape === 'headphones') {
    const R=88;
    for (let i=0;i<1500;i++){ // band
      const t = -0.08*Math.PI + Math.random()*1.16*Math.PI;
      const tr = 8*Math.sqrt(Math.random()), a = Math.random()*Math.PI*2;
      push((R+tr*Math.cos(a))*Math.cos(t), (R*0.92+tr*Math.cos(a))*Math.sin(t)-26, tr*Math.sin(a), Math.random()<0.7?metal:base);
    }
    for (const sx of [-1,1]) { // cups
      for (let i=0;i<800;i++){
        const u=Math.random()*Math.PI*2, v=Math.acos(2*Math.random()-1);
        const x=sx*R + sx*16*Math.cos(v);
        const y=-26 + 44*Math.sin(v)*Math.cos(u);
        const z=36*Math.sin(v)*Math.sin(u);
        const ring = Math.abs(Math.cos(v))<0.18;
        push(x,y,z, ring?accent:base);
      }
    }
  }
  return P;
}

// ---------------------------------------------------------- renderer
const ENV_TINT = {
  studio:      { mul:[1.02,1.02,1.04], rim:[255,255,255] },
  golden_hour: { mul:[1.22,0.98,0.72], rim:[255,196,120] },
  neon_night:  { mul:[0.72,0.82,1.25], rim:[80,240,255] },
  forest:      { mul:[0.86,1.08,0.88], rim:[190,255,170] }
};

function splatView(canvas, points, opts = {}) {
  const ctx = canvas.getContext('2d');
  const state = { yaw: 0.6, tilt: 0.34, speed: opts.speed ?? 0.35, env: 'studio', dragging: false, lastX: 0, running: true, mode: 'auto' };
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  function fit() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * DPR; canvas.height = (r.height || 190) * DPR;
  }
  fit();

  canvas.addEventListener('pointerdown', e => { state.dragging = true; state.lastX = e.clientX; canvas.style.cursor='grabbing'; });
  window.addEventListener('pointermove', e => { if (state.dragging){ state.yaw += (e.clientX - state.lastX)*0.012; state.lastX = e.clientX; }});
  window.addEventListener('pointerup', () => { state.dragging = false; canvas.style.cursor='grab'; });

  let last = performance.now();
  function frame(now) {
    if (!state.running) return;
    const dt = (now - last)/1000; last = now;
    if (!state.dragging && state.mode !== 'static') state.yaw += state.speed * dt * (state.mode==='turntable'?3.2:1);
    draw();
    requestAnimationFrame(frame);
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    const cy=Math.cos(state.yaw), sy=Math.sin(state.yaw), cx=Math.cos(state.tilt), sx=Math.sin(state.tilt);
    const tint = ENV_TINT[state.env] || ENV_TINT.studio;
    const scaleFit = Math.min(W,H)/300;
    const proj = [];
    for (const p of points) {
      const x1 = p.x*cy - p.z*sy, z1 = p.x*sy + p.z*cy;
      const y1 = p.y*cx - z1*sx,  z2 = p.y*sx + z1*cx;
      const s = 340/(340+z2);
      proj.push([x1*s*scaleFit + W/2, -y1*s*scaleFit + H/2 + 8*scaleFit, z2, p, s, x1]);
    }
    proj.sort((a,b) => b[2]-a[2]);
    for (const [px,py,z,p,s,x1] of proj) {
      let r=p.c[0]*tint.mul[0], g=p.c[1]*tint.mul[1], b=p.c[2]*tint.mul[2];
      if (x1 > 26) { const k=Math.min(1,(x1-26)/70)*0.55; r+=tint.rim[0]*k; g+=tint.rim[1]*k; b+=tint.rim[2]*k; }
      ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${0.5+0.42*s})`;
      const rad = Math.max(0.7, p.s*2.1*s*scaleFit*DPR*0.62);
      ctx.beginPath(); ctx.arc(px,py,rad,0,6.2832); ctx.fill();
    }
  }
  requestAnimationFrame(frame);
  return {
    setEnv: e => { state.env = e; },
    setMode: m => { state.mode = m; },
    stop: () => { state.running = false; }
  };
}

// ---------------------------------------------------------- hero SVG
const HERO_ENVS = {
  studio:      { sky:['#f2f2f5','#c9c9d2'], floor:'#b9b9c4', shadow:'rgba(20,20,30,.35)', rim:'#ffffff', warm:0 },
  golden_hour: { sky:['#ffd99e','#b35a24'], floor:'#7c3d18', shadow:'rgba(60,20,0,.45)', rim:'#ffd9a0', warm:1 },
  neon_night:  { sky:['#12121e','#251440'], floor:'#0c0c16', shadow:'rgba(0,0,0,.6)', rim:'#53f0ff', warm:0 },
  forest:      { sky:['#dcead2','#7fa06c'], floor:'#4d6b42', shadow:'rgba(20,40,15,.4)', rim:'#eaffdc', warm:0 }
};

function heroSVG(prod, env) {
  const E = HERO_ENVS[env] || HERO_ENVS.studio;
  const pal = prod.palette;
  const uid = 'g' + Math.random().toString(36).slice(2,8);
  let shape = '';
  const cx = 200, baseY = 258;

  if (prod.shape === 'can') shape = `
    <rect x="${cx-46}" y="${baseY-150}" width="92" height="150" rx="10" fill="url(#${uid}b)"/>
    <ellipse cx="${cx}" cy="${baseY-150}" rx="46" ry="9" fill="${pal.metal}"/>
    <ellipse cx="${cx}" cy="${baseY-150}" rx="38" ry="6.5" fill="#eef0f2"/>
    <rect x="${cx-46}" y="${baseY-116}" width="92" height="78" fill="${pal.base}"/>
    <rect x="${cx-46}" y="${baseY-122}" width="92" height="5" fill="${pal.accent}"/>
    <text x="${cx}" y="${baseY-70}" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="21" fill="${pal.accent}">Ember</text>
    <rect x="${cx-46}" y="${baseY-150}" width="20" height="150" rx="8" fill="rgba(255,255,255,.28)"/>`;

  if (prod.shape === 'perfume') shape = `
    <rect x="${cx-14}" y="${baseY-176}" width="28" height="30" rx="4" fill="${pal.metal}"/>
    <rect x="${cx-52}" y="${baseY-148}" width="104" height="148" rx="8" fill="url(#${uid}b)"/>
    <rect x="${cx-40}" y="${baseY-134}" width="80" height="122" rx="5" fill="${pal.base}" opacity=".82"/>
    <text x="${cx}" y="${baseY-64}" text-anchor="middle" font-family="Georgia,serif" font-size="12" letter-spacing="3" fill="#1a1a22">NOCTURNE</text>
    <text x="${cx}" y="${baseY-48}" text-anchor="middle" font-family="Georgia,serif" font-size="10" fill="#1a1a22">N°7</text>
    <rect x="${cx-52}" y="${baseY-148}" width="16" height="148" rx="6" fill="rgba(255,255,255,.35)"/>`;

  if (prod.shape === 'sneaker') shape = `
    <path d="M ${cx-118} ${baseY-14} Q ${cx-124} ${baseY-58} ${cx-86} ${baseY-72} Q ${cx-40} ${baseY-88} ${cx+8} ${baseY-64} Q ${cx+66} ${baseY-38} ${cx+112} ${baseY-30} Q ${cx+128} ${baseY-26} ${cx+124} ${baseY-12} L ${cx-118} ${baseY-12} Z" fill="${pal.base}"/>
    <path d="M ${cx-120} ${baseY-14} L ${cx+126} ${baseY-14} Q ${cx+134} ${baseY-6} ${cx+120} ${baseY} L ${cx-108} ${baseY} Q ${cx-126} ${baseY-4} ${cx-120} ${baseY-14} Z" fill="${pal.metal}"/>
    <path d="M ${cx-60} ${baseY-70} Q ${cx-20} ${baseY-80} ${cx+4} ${baseY-62}" stroke="${pal.accent}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M ${cx+30} ${baseY-52} Q ${cx+60} ${baseY-60} ${cx+82} ${baseY-40}" stroke="${pal.accent}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>`;

  if (prod.shape === 'cloud') {
    let dots = '';
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * 6.283, r = Math.pow(Math.random(), 0.5);
      dots += `<circle cx="${(cx + Math.cos(a) * r * 70).toFixed(1)}" cy="${(baseY - 75 + Math.sin(a) * r * 60).toFixed(1)}" r="${(1 + Math.random() * 2.4).toFixed(1)}" fill="${pal.base}" opacity="${(0.35 + Math.random() * 0.6).toFixed(2)}"/>`;
    }
    shape = dots;
  }

  if (prod.shape === 'headphones') shape = `
    <path d="M ${cx-64} ${baseY-72} Q ${cx-64} ${baseY-170} ${cx} ${baseY-170} Q ${cx+64} ${baseY-170} ${cx+64} ${baseY-72}" stroke="${pal.metal}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <rect x="${cx-84}" y="${baseY-92}" width="38" height="76" rx="18" fill="${pal.base}"/>
    <rect x="${cx+46}" y="${baseY-92}" width="38" height="76" rx="18" fill="${pal.base}"/>
    <rect x="${cx-80}" y="${baseY-86}" width="6" height="64" rx="3" fill="${pal.accent}" opacity=".9"/>
    <rect x="${cx+74}" y="${baseY-86}" width="6" height="64" rx="3" fill="${pal.accent}" opacity=".9"/>`;

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${E.sky[0]}"/><stop offset="1" stop-color="${E.sky[1]}"/>
      </linearGradient>
      <linearGradient id="${uid}b" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${pal.metal}"/><stop offset=".5" stop-color="#f2f3f5"/><stop offset="1" stop-color="${pal.metal}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#${uid}s)"/>
    <rect y="252" width="400" height="48" fill="${E.floor}"/>
    ${env==='neon_night' ? `<rect x="0" y="0" width="400" height="300" fill="none"/><circle cx="330" cy="60" r="26" fill="none" stroke="#ff4fd8" stroke-width="3" opacity=".8"/><circle cx="330" cy="60" r="38" fill="none" stroke="#53f0ff" stroke-width="2" opacity=".5"/>` : ''}
    ${env==='golden_hour' ? `<circle cx="70" cy="70" r="34" fill="#ffedc4" opacity=".9"/>` : ''}
    <ellipse cx="200" cy="262" rx="105" ry="13" fill="${E.shadow}"/>
    ${shape}
    <rect x="${cx+34}" y="${baseY-160}" width="3" height="160" fill="${E.rim}" opacity=".0"/>
    <text x="12" y="290" font-family="ui-monospace,monospace" font-size="9" fill="rgba(255,255,255,.55)">◉ C2PA · ${prod.id} · ${env} · relit from master splat</text>
  </svg>`;
}

// ---------------------------------------------------------- library
let PRODUCTS = [];
const thumbViews = [];

async function getPointsFor(p) {
  if (p.points_url) {
    try { return await fetch(p.points_url).then(r => r.json()); } catch (e) {}
  }
  return genPoints(p.shape, p.palette);
}

async function renderLibrary() {
  PRODUCTS = await api.list();
  const grid = $('#grid'); grid.innerHTML = '';
  for (const p of PRODUCTS) {
    const card = el('div', 'card');
    const cv = document.createElement('canvas');
    card.appendChild(cv);
    const ingested = !!p.points_url;
    const meta = el('div', 'meta', `
      <div class="name">${p.name}</div>
      <div class="brandline">${p.brand} · ${p.category}</div>
      <div class="badges">
        ${p.verified ? '<span class="badge verified">✓ verified</span>' : '<span class="badge" style="color:var(--bad);border-color:#5a2b2b">⚠ provisional</span>'}
        ${p.deltaE != null ? `<span class="badge qa">ΔE ${p.deltaE}</span>` : ''}
        ${p.dimensions_mm ? `<span class="badge">${p.dimensions_mm[2]} mm</span>` : ''}
        ${p.gaussian_count ? `<span class="badge">${(p.gaussian_count/1000).toFixed(0)}k gaussians · real 3DGS</span>` : ''}
        ${p.gtin ? `<span class="badge">${p.gtin}</span>` : ''}
      </div>`);
    card.appendChild(meta);
    card.onclick = () => openDetail(p.id);
    grid.appendChild(card);
    getPointsFor(p).then(pts => thumbViews.push(splatView(cv, pts, { speed: 0.28 })));
  }
}

// ---------------------------------------------------------- detail
let currentView = null, currentProd = null, currentEnv = 'studio', currentRung = 5;

async function openDetail(id) {
  currentProd = PRODUCTS.find(p => p.id === id);
  const manifest = await api.tool('get_manifest', { id });
  $('#dTitle').textContent = currentProd.name;
  $('#detail').classList.add('open');
  document.body.style.overflow = 'hidden';

  if (currentView) currentView.stop();
  const cv = $('#splatCanvas');
  currentView = splatView(cv, await getPointsFor(currentProd), { speed: 0.3 });
  currentEnv = 'studio'; currentRung = 5;

  renderRungs(); renderEnvs(); applyRung();
  renderManifest(manifest);
}

function closeDetail() {
  $('#detail').classList.remove('open');
  document.body.style.overflow = '';
  if (currentView) { currentView.stop(); currentView = null; }
}

const RUNG_LABELS = { 1:'1 · Data', 2:'2 · Hero still', 3:'3 · Turntable', 4:'4 · Static splat', 5:'5 · Relightable splat' };

function renderRungs() {
  const box = $('#rungs'); box.innerHTML = '';
  for (const r of [5,4,3,2,1]) {
    const b = el('button', r === currentRung ? 'active' : '', RUNG_LABELS[r]);
    b.onclick = () => { currentRung = r; renderRungs(); applyRung(); };
    box.appendChild(b);
  }
}

function renderEnvs() {
  const box = $('#envs'); box.innerHTML = '';
  for (const e of ['studio','golden_hour','neon_night','forest']) {
    const b = el('button', e === currentEnv ? 'active' : '', e.replace('_',' '));
    b.onclick = () => { currentEnv = e; renderEnvs(); applyEnv(); };
    box.appendChild(b);
  }
}

function applyEnv() {
  if (currentView) currentView.setEnv(currentEnv);
  if (currentRung === 2) $('#heroBox').innerHTML = heroSVG(currentProd, currentEnv);
}

async function applyRung() {
  const cv = $('#splatCanvas'), hero = $('#heroBox'), hint = $('#viewerHint'), envs = $('#envs');
  hero.style.display = 'none'; cv.style.display = 'block'; envs.style.display = 'flex';
  if (currentRung === 5) { currentView.setMode('auto'); hint.textContent = 'drag to orbit — relightable splat (rung 5)'; }
  if (currentRung === 4) { currentView.setMode('static'); hint.textContent = 'static splat / mesh proxy — drag to orbit (rung 4)'; }
  if (currentRung === 3) { currentView.setMode('turntable'); hint.textContent = 'turntable render (rung 3)'; }
  if (currentRung === 2) {
    cv.style.display = 'none'; hero.style.display = 'block';
    hero.innerHTML = heroSVG(currentProd, currentEnv);
    hint.textContent = 'hero still, relit on demand (rung 2)';
  }
  if (currentRung === 1) {
    cv.style.display = 'none'; envs.style.display = 'none';
    hero.style.display = 'block';
    const m = await api.tool('get_manifest', { id: currentProd.id });
    hero.innerHTML = `<pre class="raw" style="max-height:340px;overflow-y:auto">${escapeHTML(JSON.stringify(m, null, 2))}</pre>`;
    hint.textContent = 'structured data — what every LLM agent reads today (rung 1)';
  }
  applyEnv();
  const desc = await api.tool('get_rendition', { id: currentProd.id, rung: currentRung, lighting_env: currentEnv });
  $('#rungNote').textContent = `${desc.format} → ${desc.consumers}`;
}

function escapeHTML(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

function renderManifest(m) {
  const c = m.measured.colour;
  const pane = $('#manifestPane');
  pane.innerHTML = `
    <div class="tier"><h3>Tier 1 · Identity</h3>
      <div class="kv">
        <span class="k">GTIN</span><span class="v">${m.gtin}</span>
        <span class="k">SKU</span><span class="v">${m.sku}</span>
        <span class="k">Brand</span><span class="v">${m.brand.name} ${m.brand.verified?'✓ verified':''}</span>
      </div>
    </div>
    <div class="tier"><h3>Tier 2 · Measured truth</h3>
      <div class="kv">
        ${m.measured.gaussian_count ? `<span class="k">Gaussians</span><span class="v">${m.measured.gaussian_count.toLocaleString()} (real 3DGS capture)</span>` : ''}
        <span class="k">Dimensions</span><span class="v">${m.measured.dimensions_mm ? m.measured.dimensions_mm.join(' × ') + ' mm' : (m.measured.dimensions_scene_units ? m.measured.dimensions_scene_units.join(' × ') + ' scene units — <span style="color:var(--bad)">uncalibrated</span>' : 'n/a')}</span>
        ${m.measured.mass_g ? `<span class="k">Mass</span><span class="v">${m.measured.mass_g} g</span>` : ''}
        <span class="k">Colour</span><span class="v"><span class="swatch" style="background:${c.primary_hex}"></span>${c.primary_hex} · Lab ${c.primary_lab.join(', ')}</span>
        <span class="k">ΔE vs spec</span><span class="v">${c.deltaE_vs_brand_spec != null ? c.deltaE_vs_brand_spec : '—'} <span style="color:${m.qa.status === 'PASS' ? 'var(--ok)' : 'var(--bad)'}">(${m.qa.status})</span></span>
        <span class="k">Capture</span><span class="v">${m.measured.captureSession.rig_id} · ${m.measured.captureSession.date}</span>
        <span class="k">Passes</span><span class="v">${m.measured.captureSession.passes.join(' · ')}</span>
      </div>
      <div class="chips">${m.measured.materials.map(x => `<span class="chip">${x.region}: ${x.class} · ${x.relight_track} track</span>`).join('')}</div>
    </div>
    <div class="tier"><h3>Tier 3 · Governance &amp; licence</h3>
      <div class="chips">${m.brandRules.approved_contexts.map(x => `<span class="chip yes">✓ ${x}</span>`).join('')}
      ${m.brandRules.excluded_contexts.map(x => `<span class="chip no">✕ ${x}</span>`).join('')}</div>
      <div class="kv" style="margin-top:10px">
        <span class="k">Licensed for</span><span class="v">${m.license.usage.join(', ')}</span>
        <span class="k">Training</span><span class="v" style="color:var(--bad)">false — data moat</span>
        <span class="k">Territory</span><span class="v">${m.license.territory}</span>
        <span class="k">Expires</span><span class="v">${m.license.expires}</span>
      </div>
    </div>
    <div class="actions">
      <button id="btnVerify">⛓ Verify provenance</button>
      <select id="licSelect">
        <option value="advertising">advertising</option>
        <option value="agent_display">agent_display</option>
        <option value="ar_commerce">ar_commerce</option>
        <option value="training">training</option>
      </select>
      <button id="btnLicense">Request licence</button>
    </div>
    <div id="verifyOut"></div>
    <div id="licenseOut"></div>
    <button class="toggle-raw" id="btnRaw">show raw truth manifest</button>
    <pre class="raw" id="rawBox" style="display:none"></pre>
  `;

  $('#btnVerify').onclick = async () => {
    const v = await api.tool('verify_asset', { id: m.sku ? currentProd.id : currentProd.id });
    const out = $('#verifyOut'); out.innerHTML = '';
    for (const s of v.chain) {
      out.appendChild(el('div','chainstep',
        `<span class="${s.ok?'tick':'cross'}">${s.ok?'✓':'✕'}</span> <b>${s.step}</b> <span style="color:var(--txt3)">${summarise(s.detail)}</span>`));
    }
    out.appendChild(el('div', 'result-banner ' + (v.valid?'ok':'no'), v.status));
  };

  $('#btnLicense').onclick = async () => {
    const uc = $('#licSelect').value;
    const r = await api.tool('request_license', { id: currentProd.id, use_case: uc });
    $('#licenseOut').innerHTML = '';
    $('#licenseOut').appendChild(el('div', 'result-banner ' + (r.granted?'ok':'no'),
      r.granted ? `GRANTED · ${uc} · token ${r.token} · expires ${r.expires}` : `DENIED · ${escapeHTML(r.reason)}`));
  };

  $('#btnRaw').onclick = () => {
    const b = $('#rawBox');
    const showing = b.style.display !== 'none';
    b.style.display = showing ? 'none' : 'block';
    $('#btnRaw').textContent = showing ? 'show raw truth manifest' : 'hide raw truth manifest';
    if (!showing) b.textContent = JSON.stringify(m, null, 2);
  };
}

function summarise(d) {
  if (!d) return '';
  if (d.rig_id) return `${d.rig_id} · ${d.date}`;
  if (d.deltaE !== undefined) return `ΔE ${d.deltaE} · geo ${d.geometry_dev_mm}mm · logo ${d.logo_integrity}`;
  if (d.sha256_hmac) return d.sha256_hmac;
  if (d.signer !== undefined) return d.match ? `${d.signer} · ${d.signed_at}` : 'signature mismatch';
  return '';
}

// ---------------------------------------------------------- agent console
const SUGGESTIONS = [
  'Find me a red drinks can under 120mm in golden hour light',
  'Show the trail shoe in neon night',
  'Can I place the Nocturne bottle in a cocktail bar ad?',
  'Can I train my model on these captures?',
  'Verify the headphones — is the colour accurate?'
];

function addMsg(role, html) {
  const log = $('#chatlog');
  const m = el('div', 'msg ' + role);
  m.appendChild(el('div', 'bubble', html));
  log.appendChild(m); log.scrollTop = log.scrollHeight;
  return m;
}

function addTrace(steps) {
  const log = $('#chatlog');
  const box = el('div', 'trace');
  for (const s of steps) {
    const d = el('details', 'tracecard');
    d.innerHTML = `<summary>⚙ tool call · ${s.tool}(${JSON.stringify(s.args)})</summary>
      <div class="io"><b>→ response</b>\n${escapeHTML(JSON.stringify(s.result, null, 2))}</div>`;
    box.appendChild(d);
  }
  log.appendChild(box); log.scrollTop = log.scrollHeight;
}

const CONTEXT_MAP = [
  { words: ['cocktail','bar','whiskey','wine','beer','alcohol'], ctx: 'alcohol_adjacent' },
  { words: ['political','election','campaign rally'], ctx: 'political' },
  { words: ['discount','bargain','clearance'], ctx: 'discount_retail' }
];

function detectEnv(q) {
  if (/golden|sunset|warm/.test(q)) return 'golden_hour';
  if (/neon|night|club/.test(q)) return 'neon_night';
  if (/forest|outdoor|nature/.test(q)) return 'forest';
  return 'studio';
}

async function runAgent(text) {
  addMsg('user', escapeHTML(text));
  const q = text.toLowerCase();
  const steps = [];
  const call = async (tool, args) => { const result = await api.tool(tool, args); steps.push({ tool, args, result }); return result; };

  // 1) training intent — the moat demo
  if (/train|fine-?tune|dataset for (my|our) model/.test(q)) {
    const results = await call('search_products', { query: q.replace(/train.*model|train/g, '') || 'can' });
    const target = results[0] || { id: 'ember-cola-330', name: 'Ember Cola 330ml' };
    const lic = await call('request_license', { id: target.id, use_case: 'training' });
    addTrace(steps);
    addMsg('agent', `<b>No — licence refused, machine-readably.</b><br>I asked the library for a training grant on <b>${target.name}</b> and got a signed refusal: <i>"${escapeHTML(lic.reason)}"</i><br><br>The measured capture archive is Brand Splats' compounding moat — usable by agents for display and advertising, never scrapeable as training data.`);
    return;
  }

  // 2) placement / brand-context intent
  const ctxHit = CONTEXT_MAP.find(c => c.words.some(w => q.includes(w)));
  if (ctxHit && /place|put|use|ad|scene|next to|beside|in a/.test(q)) {
    const results = await call('search_products', { query: q });
    if (!results.length) { addTrace(steps); addMsg('agent', 'I couldn\'t find a matching asset in the library.'); return; }
    const target = results[0];
    const rules = await call('get_brand_rules', { id: target.id });
    const excluded = rules.brandRules.excluded_contexts.includes(ctxHit.ctx);
    addTrace(steps);
    if (excluded) {
      addMsg('agent', `<b>I have to decline that placement.</b><br><b>${target.name}</b> carries machine-readable brand governance, and <span style="color:var(--bad)">"${ctxHit.ctx}" is an excluded context</span> in its Truth Manifest. A human never had to review this — the rule travelled with the asset.<br><br>Approved contexts: ${rules.brandRules.approved_contexts.join(', ')}.`);
    } else {
      const lic = await call('request_license', { id: target.id, use_case: 'advertising' });
      addTrace([steps[steps.length-1]]);
      addMsg('agent', `<b>Yes — that placement is within brand rules.</b> "${ctxHit.ctx}" isn't excluded for <b>${target.name}</b>, and I've secured an advertising licence (token <span style="font-family:var(--mono)">${lic.token}</span>).`);
    }
    return;
  }

  // 3) verify intent
  if (/verify|accura|trust|provenance|check/.test(q)) {
    const results = await call('search_products', { query: q });
    if (!results.length) { addTrace(steps); addMsg('agent', 'No matching asset found to verify.'); return; }
    const target = results[0];
    const v = await call('verify_asset', { id: target.id });
    const man = await call('get_manifest', { id: target.id });
    addTrace(steps);
    const c = man.measured.colour;
    addMsg('agent', `<b>${v.status === 'VERIFIED' ? '✓ VERIFIED' : '✕ ' + v.status}</b> — <b>${target.name}</b><br>
      Signature chain: capture session → QA gate → manifest hash → rig signature, all ${v.valid ? 'valid' : 'INVALID'}.<br><br>
      Measured colour <span class="swatch" style="background:${c.primary_hex}"></span><span style="font-family:var(--mono)">${c.primary_hex}</span> — ΔE <b>${c.deltaE_vs_brand_spec}</b> against brand spec (QA: ${man.qa.status}). That's a rig measurement, not marketing copy — which is why an agent can repeat it to a buyer.`);
    return;
  }

  // 4) default: search → manifest → verify → hero rendition
  const results = await call('search_products', { query: q });
  if (!results.length) {
    addTrace(steps);
    addMsg('agent', 'Nothing in the library matches that. Try a product type (can, perfume, shoe, headphones), a colour, or a size constraint like "under 120mm".');
    return;
  }
  const target = results[0];
  const man = await call('get_manifest', { id: target.id });
  const v = await call('verify_asset', { id: target.id });
  const env = detectEnv(q);
  const rend = await call('get_rendition', { id: target.id, rung: 2, lighting_env: env });
  addTrace(steps);
  const prod = PRODUCTS.find(p => p.id === target.id);
  const c = man.measured.colour;
  addMsg('agent', `<b>${target.name}</b> — ${man.brand.name} ${v.valid ? '· <span style="color:var(--ok)">✓ verified</span>' : ''}<br>
    <span style="font-family:var(--mono);font-size:12px;color:var(--txt2)">${man.measured.dimensions_mm.join('×')} mm · ${c.primary_hex} · ΔE ${c.deltaE_vs_brand_spec} · GTIN ${man.gtin}</span><br>
    <div class="heroimg">${prod ? heroSVG(prod, env) : ''}</div>
    <span style="font-size:12px;color:var(--txt3)">Hero still relit on demand for "${env.replace('_',' ')}" — derived from the master splat, ${escapeHTML(rend.derived_from)}.</span>`);
}

// ---------------------------------------------------------- gateway view
async function renderGateway() {
  const meta = await api.mcp();
  const box = $('#endpoints'); box.innerHTML = '';
  const rest = [
    ['GET /api/products?q={query}', 'Search the library (colour, type, size constraints).', `curl 'http://localhost:4747/api/products?q=red+can+under+120mm'`],
    ['GET /api/products/{id}/manifest', 'Signed Truth Manifest (JSON-LD).', `curl http://localhost:4747/api/products/ember-cola-330/manifest`],
    ['GET /api/products/{id}/rendition?rung=2&env=golden_hour', 'Rendition ladder rungs 1–5.', `curl 'http://localhost:4747/api/products/ember-cola-330/rendition?rung=2&env=golden_hour'`],
    ['GET /api/products/{id}/verify', 'Recompute + check manifest signature (C2PA-style chain).', `curl http://localhost:4747/api/products/ember-cola-330/verify`],
    ['GET /api/products/{id}/rules', 'Machine-readable brand governance.', `curl http://localhost:4747/api/products/nocturne-no7/rules`],
    ['POST /api/products/{id}/license', 'Request a use-case grant. Training is always refused.', `curl -X POST http://localhost:4747/api/products/orbit-one/license -d '{"use_case":"training"}'`]
  ];
  for (const [sig, desc, curl] of rest) {
    box.appendChild(el('div','endpoint',`<div class="sig">${sig}</div><div class="desc">${desc}</div><code>${escapeHTML(curl)}</code>`));
  }
  const toolsCard = el('div','endpoint');
  toolsCard.innerHTML = `<div class="sig">MCP tool surface · ${meta.server} v${meta.version}</div>
    <div class="desc">${meta.tools.map(t => `<b style="color:var(--txt)">${t.name}</b> — ${t.description}`).join('<br><br>')}</div>`;
  box.appendChild(toolsCard);
}

// ---------------------------------------------------------- boot
document.querySelectorAll('nav button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('nav button').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('#view-' + b.dataset.view).classList.add('active');
  };
});

$('#chatSend').onclick = () => { const v = $('#chatInput').value.trim(); if (v) { $('#chatInput').value=''; runAgent(v); } };
$('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#chatSend').click(); });
$('#detail').addEventListener('click', e => { if (e.target.id === 'detail') closeDetail(); });

const sugBox = $('#suggest');
for (const s of SUGGESTIONS) {
  const b = el('button', '', s);
  b.onclick = () => runAgent(s);
  sugBox.appendChild(b);
}

addMsg('agent', 'I\'m a demo agent wired to the Brand Splat gateway. Ask me to find, verify, relight, place or license a product — you\'ll see every tool call I make.');
renderLibrary();
renderGateway();
