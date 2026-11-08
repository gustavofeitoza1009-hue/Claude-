import * as THREE from './node_modules/three/build/three.module.js';

/* =========================================================
   "Um Bilhão" — animação 3D vertical (720x1280, 30fps)
   Tudo é função do tempo t (determinístico) para renderizar
   quadro a quadro: window.renderAt(t)
   ========================================================= */

const TL = await (await fetch('build/timeline.json')).json();
const S = Object.fromEntries(TL.segments.map(s => [s.id, s]));
const DUR = TL.duration;

// ---------- utilitários ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;
const sm = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const P = (t, a, b) => clamp((t - a) / (b - a));
const eo = x => 1 - Math.pow(1 - clamp(x), 3);
const back = x => { x = clamp(x); const c1 = 2.0, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const pulse = (t, a, d) => (t >= a && t < a + d) ? Math.sin(Math.PI * (t - a) / d) : 0;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- renderer / cena ----------
const W = 720, H = 1280;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 400);

const hemi = new THREE.HemisphereLight(0xd8ecff, 0x6b5a48, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xa9cfff, 1.3);
scene.add(rim, rim.target);
const spot = new THREE.SpotLight(0xffffff, 0, 30, 0.45, 0.6, 1.2);
spot.castShadow = true;
scene.add(spot, spot.target);
const lamp = new THREE.PointLight(0xffb86b, 0, 8, 1.6);
scene.add(lamp);
const fill = new THREE.DirectionalLight(0xfff4e8, 0.0);
scene.add(fill, fill.target);

// ---------- helpers de geometria ----------
const SPH = new THREE.SphereGeometry(1, 32, 24);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 28);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const LID = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const HEMI = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const M = (c, r = 0.8, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
function add(parent, geo, mat, pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos); m.scale.set(...scl); m.rotation.set(...rot);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function textTex(draw, w = 512, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function signTex(lines, { bg = '#fff', fg = '#c0392b', border = '#222', w = 512, h = 256, sizes } = {}) {
  return textTex((g, W, H) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.lineWidth = 14; g.strokeStyle = border; g.strokeRect(7, 7, W - 14, H - 14);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((l, i) => {
      const sz = sizes ? sizes[i] : Math.floor(H / (n + 0.6));
      g.font = `900 ${sz}px Inter, sans-serif`;
      g.fillText(l, W / 2, H * (i + 0.5 + 0.0) / n + 4, W - 40);
    });
  }, w, h);
}


// =========================================================
//   O MENINO QUE DERROTOU UM GIGANTE
//   Personagens criados UMA vez e reutilizados em todas as cenas
// =========================================================
const gold = new THREE.PointLight(0xffd27a, 0, 14, 1.4);
scene.add(gold);
const RND = rng(77);

// ---------- molde humano estilizado ----------
function makeHuman(o = {}) {
  const skin = M(o.skin ?? 0xe2a87c, 0.6); skin.side = THREE.DoubleSide;
  const tunicM = o.tunicMat ?? M(o.tunic ?? 0xeadbb8, 0.85);
  const dark = M(0x1e130c, 0.4), white = M(0xffffff, 0.3);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const len = o.robe ? 1.47 : 0.78, bot = o.robe ? 0.0 : 0.69;
  const torso = add(body, new THREE.CylinderGeometry(0.23, o.robe ? 0.4 : 0.33, len, 28), tunicM, [0, bot + len / 2, 0]);
  for (const s of [-1, 1]) add(body, SPH, tunicM, [s * 0.24, 1.4, 0], [0.11, 0.1, 0.11]);
  add(body, CYL, skin, [0, 1.5, 0], [0.07, 0.14, 0.07]);
  const belt = add(body, CYL, M(o.belt ?? 0x8b4a2b, 0.7), [0, 0.98, 0], [o.robe ? 0.33 : 0.3, 0.05, o.robe ? 0.33 : 0.3]);
  // cabeça
  const neck = new THREE.Group(); neck.position.y = 1.55; body.add(neck);
  const head = new THREE.Group(); head.position.y = 0.21; neck.add(head);
  add(head, SPH, skin, [0, 0, 0], [0.25, 0.26, 0.24]);
  for (const s of [-1, 1]) add(head, SPH, skin, [s * 0.245, 0.0, -0.01], [0.04, 0.06, 0.035]);
  add(head, SPH, skin, [0, -0.03, 0.245], [0.035, 0.04, 0.035]);
  const eyes = [], lids = [], balls = [], brows = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.088, 0.035, 0.2); head.add(e);
    const ball = new THREE.Group(); e.add(ball);
    add(ball, SPH, white, [0, 0, 0], [0.05, 0.055, 0.04]);
    add(ball, SPH, M(o.iris ?? 0x5a3418, 0.25), [0, 0, 0.028], [0.032, 0.034, 0.02]);
    add(ball, SPH, M(0x080505, 0.2), [0, 0, 0.04], [0.018, 0.019, 0.012]);
    const hl = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(0.012, 0.016, 0.05); hl.scale.setScalar(0.008); ball.add(hl);
    const lid = new THREE.Mesh(LID, skin); lid.scale.set(0.054, 0.058, 0.045); e.add(lid);
    const br = add(head, BOX, M(o.browCol ?? 0x3a2414, 0.8), [s * 0.09, 0.12, 0.225], [0.1, 0.022, 0.025]);
    br.userData.s = s;
    eyes.push(e); lids.push(lid); balls.push(ball); brows.push(br);
  }
  if (o.blush) for (const s of [-1, 1]) add(head, SPH, M(0xf08f8f, 0.7, 0, { transparent: true, opacity: 0.45 }), [s * 0.14, -0.06, 0.2], [0.045, 0.03, 0.02]);
  const mouth = new THREE.Group(); mouth.position.set(0, -0.11, 0.222); head.add(mouth);
  const inner = add(mouth, SPH, M(0x5a1d1d, 0.5), [0, 0, 0], [0.05, 0.012, 0.02]);
  const teeth = add(mouth, BOX, white, [0, 0.012, 0.008], [0.06, 0.012, 0.01]);
  const smileArc = add(mouth, new THREE.TorusGeometry(0.045, 0.009, 8, 20, Math.PI), M(0x8a3a32, 0.6), [0, 0.012, 0.004], [1, 1, 0.5], [0, 0, Math.PI]);
  // cabelo
  if (o.hair) {
    const hm = M(o.hair, 0.85);
    for (let i = 0; i < 34; i++) {
      const th = RND() * Math.PI * 2, ph = RND() * 1.45;
      const front = Math.cos(th) > 0.4 && ph > 0.55;      // não cobrir o rosto
      if (front) continue;
      const r = 0.255;
      add(head, SPH, hm, [Math.sin(ph) * Math.sin(th) * r, Math.cos(ph) * r + 0.02, Math.sin(ph) * Math.cos(th) * r * 0.95 - 0.02], [0.085, 0.085, 0.085].map(x => x * (0.8 + RND() * 0.4)));
    }
    for (let i = 0; i < 7; i++) add(head, SPH, hm, [-0.15 + i * 0.05, 0.19 - Math.abs(i - 3) * 0.012, 0.15], [0.07, 0.06, 0.06]);
  }
  if (o.beard) {
    const bm = M(o.beard, 0.9);
    for (let i = 0; i < 16; i++) {
      const a = -1.3 + (i / 15) * 2.6;
      add(head, SPH, bm, [Math.sin(a) * 0.2, -0.13 - Math.cos(a) * 0.06 - (i % 2) * 0.03, Math.cos(a) * 0.15 + 0.03], [0.07, 0.08, 0.06]);
    }
    for (const s of [-1, 1]) add(head, BOX, bm, [s * 0.05, -0.075, 0.235], [0.07, 0.02, 0.02], [0, 0, s * 0.25]);
  }
  if (o.helmet) {
    const hm = M(0xc58a3a, 0.3, 0.85);
    add(head, HEMI, hm, [0, 0.03, -0.01], [0.275, 0.28, 0.27]);
    add(head, CYL, hm, [0, 0.04, -0.01], [0.28, 0.03, 0.275]);
    add(head, BOX, hm, [0, -0.0, 0.265], [0.03, 0.12, 0.02]);
    for (const s of [-1, 1]) add(head, BOX, hm, [s * 0.22, -0.08, 0.06], [0.05, 0.18, 0.14], [0, s * 0.3, 0]);
    if (o.crest) for (let i = 0; i < 9; i++) add(head, BOX, M(o.crest, 0.8), [0, 0.33 + Math.sin(i / 8 * Math.PI) * 0.05, -0.2 + i * 0.05], [0.05, 0.14, 0.05]);
  }
  if (o.leatherCap) add(head, HEMI, M(o.leatherCap, 0.7), [0, 0.04, -0.01], [0.27, 0.25, 0.265]);
  if (o.crown) {
    const gm = M(0xf2c14e, 0.25, 1);
    add(head, CYL, gm, [0, 0.2, 0], [0.2, 0.07, 0.2]);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(head, new THREE.ConeGeometry(0.035, 0.1, 6), gm, [Math.sin(a) * 0.19, 0.28, Math.cos(a) * 0.19]); }
    add(head, SPH, M(0xd62839, 0.2), [0, 0.2, 0.2], [0.025, 0.025, 0.025]);
  }
  // braços
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.3, 1.4, 0); body.add(sh);
    add(sh, new THREE.CapsuleGeometry(0.06, 0.22, 6, 12), skin, [0, -0.17, 0]);
    add(sh, CYL, o.robe ? tunicM : tunicM, [0, o.robe ? -0.15 : -0.06, 0], [0.078, o.robe ? 0.32 : 0.16, 0.078]);
    const el = new THREE.Group(); el.position.y = -0.34; sh.add(el);
    add(el, new THREE.CapsuleGeometry(0.054, 0.2, 6, 12), skin, [0, -0.14, 0]);
    if (o.bracers) add(el, CYL, M(0xc58a3a, 0.3, 0.85), [0, -0.16, 0], [0.065, 0.16, 0.065]);
    const hand = new THREE.Group(); hand.position.y = -0.3; el.add(hand);
    add(hand, SPH, skin, [0, 0, 0], [0.065, 0.072, 0.055]);
    arms.push({ sh, el, hand, s });
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.11, 0.72, 0); body.add(hip);
    add(hip, new THREE.CapsuleGeometry(0.07, 0.48, 6, 12), skin, [0, -0.33, 0]);
    add(hip, BOX, M(0x6b3e22, 0.8), [0, -0.69, 0.04], [0.13, 0.05, 0.24]);
    if (o.greaves) add(hip, CYL, M(0xc58a3a, 0.3, 0.85), [0, -0.45, 0.01], [0.085, 0.3, 0.085]);
    legs.push(hip);
  }
  const c = { root, body, torso, neck, head, eyes, lids, balls, brows, inner, teeth, smileArc, arms, legs, o, acc: {} };
  if (o.armorPads) for (const s of [-1, 1]) add(body, SPH, M(0xc58a3a, 0.3, 0.85), [s * 0.27, 1.43, 0], [0.15, 0.1, 0.15]);
  return c;
}
function hpose(c, o = {}) {
  const { t = 0, talk = 0, lid = null, eye = 1, look = [0, 0], brow = 0, smile = 0.4, open = 0, head = [0, 0, 0], body = [0, 0, 0], arms = null, legs = null } = o;
  const ph = (t * 0.33 + (c.seed || 0)) % 1;
  const blink = ph > 0.96 ? Math.sin((ph - 0.96) / 0.04 * Math.PI) : 0;
  const L = lid == null ? blink : lid;
  for (const l of c.lids) l.rotation.x = lerp(-1.0, 1.6, L);
  for (const b of c.balls) { b.scale.setScalar(eye); b.rotation.set(-look[1], look[0], 0); }
  for (const b of c.brows) { b.rotation.z = b.userData.s * brow * 0.38; b.position.y = 0.12 + (brow < 0 ? -brow * 0.03 : -brow * 0.012); }
  const m = talk > 0 ? talk * (0.3 + 0.7 * Math.abs(Math.sin(t * 16 + Math.sin(t * 5) * 2))) : 0;
  const op = Math.max(m, open);
  c.inner.scale.set(0.045 + op * 0.015 + smile * 0.012, 0.01 + op * 0.06, 0.02);
  c.inner.position.y = -op * 0.02;
  c.teeth.visible = op > 0.25; c.teeth.position.y = 0.01 - op * 0.004;
  c.smileArc.visible = op < 0.2;
  c.smileArc.scale.set(0.7 + Math.abs(smile) * 0.5, Math.abs(smile) * 0.9 + 0.1, 0.5);
  c.smileArc.rotation.z = smile >= 0 ? Math.PI : 0;
  c.smileArc.position.y = smile >= 0 ? 0.015 : -0.03;
  c.head.rotation.set(head[0], head[1], head[2]);
  c.body.rotation.set(body[0], body[1], body[2]);
  const def = [[0.05, 0, 0.1], [0.05, 0, -0.1]];
  for (let i = 0; i < 2; i++) {
    const a = c.arms[i], r = arms && arms[i] ? arms[i] : null;
    const sh = r ? r[0] : def[i];
    a.sh.rotation.set(sh[0], sh[1], sh[2]);
    a.el.rotation.set(r && r[1] != null ? r[1] : -0.15, 0, 0);
  }
  for (let i = 0; i < 2; i++) c.legs[i].rotation.set(legs ? legs[i] : 0, 0, 0);
}
const walkLegs = (t, sp = 7, a = 0.45) => [Math.sin(t * sp) * a, -Math.sin(t * sp) * a];
const walkArms = (t, sp = 7, a = 0.4) => [[[-Math.sin(t * sp) * a, 0, 0.1], -0.3], [[Math.sin(t * sp) * a, 0, -0.1], -0.3]];

// ---------- elenco (cada um criado uma única vez) ----------
const scaleTex = textTex((g, W, H) => {
  g.fillStyle = '#9c6a2e'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < 18; y++) for (let x = 0; x < 14; x++) {
    g.fillStyle = (x + y) % 3 ? '#c99a4a' : '#b5863c';
    g.beginPath(); g.arc(x * 38 + (y % 2) * 19, y * 30, 20, 0, Math.PI); g.fill();
    g.strokeStyle = '#7a4f1f'; g.lineWidth = 3; g.stroke();
  }
}, 512, 512);
scaleTex.wrapS = scaleTex.wrapT = THREE.RepeatWrapping; scaleTex.repeat.set(2, 1.4);
const armorM = new THREE.MeshStandardMaterial({ map: scaleTex, roughness: 0.35, metalness: 0.7 });

const davi = makeHuman({ skin: 0xe8b08a, tunic: 0xeedfba, belt: 0xc0392b, hair: 0x6b3a1e, iris: 0x4a2a14, blush: true, browCol: 0x5a3018 });
const golias = makeHuman({ skin: 0xc48a62, tunicMat: armorM, belt: 0x5a3a1a, helmet: true, crest: 0xb3262e, beard: 0x24170f, browCol: 0x24170f, bracers: true, greaves: true, armorPads: true, iris: 0x2a1a0c });
golias.torso.scale.set(1.3, 1, 1.2);
for (const a of golias.arms) a.sh.scale.setScalar(1.25);
golias.head.scale.setScalar(0.92);
const saul = makeHuman({ skin: 0xd9a07a, tunic: 0x6c3fa6, robe: true, belt: 0xf2c14e, crown: true, beard: 0x9a9a9a, browCol: 0x7a7a7a });
const soldiers = [];
for (let i = 0; i < 7; i++) {
  const s = makeHuman({ skin: [0xe0a57c, 0xc98f66, 0xd9a07a][i % 3], tunic: [0x8a5a3a, 0x6d7f3f, 0x7a4a3a][i % 3], leatherCap: 0x6b4226, beard: i % 2 ? 0x3a2414 : null, browCol: 0x2a1a10 });
  s.seed = i * 0.17;
  // escudo e lança
  const sh = new THREE.Group(); s.arms[1].hand.add(sh); sh.position.set(0, 0, 0.12);
  add(sh, CYL, M(0x9a6a3a, 0.7), [0, 0, 0], [0.3, 0.04, 0.3], [Math.PI / 2, 0, 0]);
  add(sh, new THREE.TorusGeometry(0.3, 0.025, 8, 28), M(0xc58a3a, 0.3, 0.8), [0, 0, 0.02]);
  add(sh, SPH, M(0xc58a3a, 0.3, 0.8), [0, 0, 0.03], [0.06, 0.06, 0.04]);
  const sp = new THREE.Group(); s.arms[0].hand.add(sp);
  add(sp, CYL, M(0x7a5233, 0.8), [0, 0.3, 0], [0.018, 1.8, 0.018]);
  add(sp, new THREE.ConeGeometry(0.04, 0.16, 8), M(0xbfc6cc, 0.2, 0.9), [0, 1.27, 0]);
  s.shield = sh; s.spear = sp;
  soldiers.push(s);
}
const philistines = [];
for (let i = 0; i < 6; i++) { const p = makeHuman({ skin: 0xd09a72, tunic: 0xb3262e, helmet: true, crest: 0x2b2b2b, browCol: 0x2a1a10 }); p.seed = i * 0.21; philistines.push(p); }
davi.seed = 0.2; golias.seed = 0.6; saul.seed = 0.4;
const humans = [davi, golias, saul, ...soldiers, ...philistines];
// Golias gira em torno dos pés quando cai
const goliasPivot = new THREE.Group(); scene.add(goliasPivot); goliasPivot.add(golias.root);
for (const h of humans) if (h !== golias) scene.add(h.root);
golias.root.scale.setScalar(2.6);
// lança e escudo do gigante
{
  const sp = new THREE.Group(); golias.arms[0].hand.add(sp); golias.spear = sp;
  add(sp, CYL, M(0x5a3a22, 0.7), [0, 0.35, 0], [0.025, 2.2, 0.025]);
  add(sp, new THREE.ConeGeometry(0.05, 0.25, 8), M(0xbfc6cc, 0.2, 0.9), [0, 1.55, 0]);
  const sh = new THREE.Group(); golias.arms[1].hand.add(sh); sh.position.set(0, -0.05, 0.12); golias.shield = sh;
  add(sh, CYL, M(0xc58a3a, 0.3, 0.85), [0, 0, 0], [0.36, 0.04, 0.36], [Math.PI / 2, 0, 0]);
  add(sh, new THREE.TorusGeometry(0.3, 0.02, 8, 30), M(0x8a5a22, 0.4, 0.8), [0, 0, 0.025]);
  add(sh, SPH, M(0x8a5a22, 0.4, 0.8), [0, 0, 0.03], [0.07, 0.07, 0.04]);
}
// bolsa de pastor e cajado do Davi
{
  const bag = add(davi.body, SPH, M(0x8b5a2b, 0.8), [0.3, 0.92, 0.1], [0.11, 0.13, 0.07]);
  add(davi.body, BOX, M(0x6b3e22, 0.8), [0.05, 1.18, 0.02], [0.05, 0.75, 0.04], [0, 0, 0.78]);
  davi.acc.bag = bag;
  const staff = new THREE.Group(); davi.arms[1].hand.add(staff); davi.acc.staff = staff;
  add(staff, CYL, M(0x8b5a2b, 0.8), [0, 0.15, 0], [0.025, 1.9, 0.025]);
  add(staff, new THREE.TorusGeometry(0.1, 0.025, 8, 16, Math.PI), M(0x8b5a2b, 0.8), [-0.1, 1.1, 0], [1, 1, 1], [0, 0, 0]);
  // armadura grande demais (cena do rei)
  const arm = new THREE.Group(); davi.body.add(arm); davi.acc.armor = arm;
  add(arm, new THREE.CylinderGeometry(0.33, 0.45, 1.0, 24), armorM, [0, 1.0, 0]);
  for (const s of [-1, 1]) add(arm, SPH, M(0xc58a3a, 0.3, 0.85), [s * 0.36, 1.45, 0], [0.2, 0.13, 0.2]);
  const helm = new THREE.Group(); davi.head.add(helm); davi.acc.helm = helm;
  add(helm, HEMI, M(0xc58a3a, 0.3, 0.85), [0, -0.02, 0], [0.33, 0.36, 0.33]);
  add(helm, CYL, M(0xc58a3a, 0.3, 0.85), [0, -0.02, 0], [0.34, 0.04, 0.34]);
  for (let i = 0; i < 7; i++) add(helm, BOX, M(0x1f4fa8, 0.8), [0, 0.43 + Math.sin(i / 6 * Math.PI) * 0.05, -0.15 + i * 0.05], [0.05, 0.14, 0.05]);
}
// funda (corda + bolsinha) — posicionada no mundo a cada quadro
const slingCordM = M(0x8b5a2b, 0.8);
const cord1 = new THREE.Mesh(CYL, slingCordM), cord2 = new THREE.Mesh(CYL, slingCordM);
const pouch = new THREE.Mesh(SPH, M(0x6b3e22, 0.8)); pouch.scale.set(0.05, 0.035, 0.05);
const stoneInPouch = new THREE.Mesh(SPH, M(0x9aa0a6, 0.6)); stoneInPouch.scale.setScalar(0.045);
scene.add(cord1, cord2, pouch, stoneInPouch);
function placeCord(m, a, b, r = 0.008) {
  const d = b.clone().sub(a); const L = d.length();
  m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(r, L, r);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
}
function updateSling(mode, t, o = {}) {
  const vis = !!mode; cord1.visible = cord2.visible = pouch.visible = vis; stoneInPouch.visible = vis && !!o.stone;
  if (!vis) return;
  davi.root.updateMatrixWorld(true);
  const h = davi.arms[0].hand.getWorldPosition(V(0, 0, 0));
  let p;
  if (mode === 'hang') p = h.clone().add(V(0.05, -0.5, 0.05));
  else { const a = o.angle; p = h.clone().add(V(Math.cos(a) * 0.55, 0.12, Math.sin(a) * 0.55)); }
  const mid = h.clone().lerp(p, 0.5);
  placeCord(cord1, h, p.clone().add(V(0.03, 0, 0))); placeCord(cord2, h, p.clone().add(V(-0.03, 0, 0)));
  pouch.position.copy(p); stoneInPouch.position.copy(p).add(V(0, 0.02, 0));
}
// pedras
const stoneM = M(0x9aa0a6, 0.6);
const stones = []; for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), stoneM); s.scale.setScalar(0.06); s.castShadow = true; scene.add(s); stones.push(s); }
const flyStone = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), stoneM); flyStone.scale.setScalar(0.07); scene.add(flyStone);
const trail = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0.5 - i * 0.07, depthWrite: false })); m.scale.setScalar(0.1 - i * 0.012); scene.add(m); trail.push(m); }
// ovelhas
function makeSheep() {
  const g = new THREE.Group();
  const wool = M(0xfaf7f0, 0.95), face = M(0x2b2420, 0.7);
  for (let i = 0; i < 9; i++) add(g, SPH, wool, [(i % 3 - 1) * 0.16, 0.5 + (i % 2) * 0.06, (Math.floor(i / 3) - 1) * 0.18], [0.17, 0.16, 0.17]);
  const hd = new THREE.Group(); hd.position.set(0, 0.55, 0.36); g.add(hd);
  add(hd, SPH, face, [0, 0, 0], [0.1, 0.12, 0.13]);
  for (const s of [-1, 1]) { add(hd, SPH, face, [s * 0.1, 0.03, -0.02], [0.06, 0.025, 0.035], [0, 0, s * 0.3]); add(hd, SPH, M(0xffffff, 0.3), [s * 0.05, 0.04, 0.1], [0.022, 0.022, 0.015]); }
  add(hd, SPH, wool, [0, 0.11, -0.02], [0.09, 0.06, 0.09]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, CYL, face, [sx * 0.13, 0.17, sz * 0.18], [0.035, 0.34, 0.035]);
  g.userData.head = hd;
  return g;
}
const sheep = []; for (let i = 0; i < 6; i++) { const s = makeSheep(); scene.add(s); sheep.push(s); }

// ---------- partículas ----------
const dustTex = textTex((g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(214,190,150,.9)'); gr.addColorStop(1, 'rgba(214,190,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }, 128, 128);
const dust = []; for (let i = 0; i < 28; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false })); scene.add(s); dust.push(s); }
const dR = []; { const r = rng(12); for (let i = 0; i < 28; i++) dR.push([r(), r(), r()]); }
function updateDust(t0, t, center, spread = 6) {
  dust.forEach((s, i) => {
    const dt = t - t0 - dR[i][2] * 0.15; s.visible = t0 != null && dt > 0 && dt < 3;
    if (!s.visible) return;
    const a = dR[i][0] * Math.PI * 2, k = 1 - Math.exp(-dt * 2);
    s.position.set(center.x + (dR[i][1] - 0.5) * spread + Math.cos(a) * k * 1.5, 0.3 + k * (0.6 + dR[i][1]), center.z + Math.sin(a) * k * 1.8);
    const sc = 0.8 + k * 1.6; s.scale.set(sc, sc, sc); s.material.opacity = 0.85 * (1 - dt / 3);
  });
}
const starTex = textTex((g, W, H) => {
  g.translate(W / 2, H / 2); g.fillStyle = '#fff6c8';
  g.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 22 : 62; const a = i / 16 * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 18, 0, 7); g.fill();
}, 128, 128);
const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, depthTest: false })); scene.add(star);
const sparkM = new THREE.MeshBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0.9, depthWrite: false });
const sparks = []; for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(1), sparkM); scene.add(s); sparks.push(s); }
function updateSparks(on, t, c, rad = 1) {
  sparks.forEach((s, i) => {
    s.visible = on; if (!on) return;
    const ph = (t * 0.6 + i / 18) % 1, a = i * 2.39;
    s.position.set(c.x + Math.cos(a) * rad * (0.5 + ph * 0.5), c.y + (ph - 0.3) * rad * 1.6, c.z + Math.sin(a) * rad * 0.6);
    s.scale.set(0.03, 0.07, 0.03).multiplyScalar(Math.sin(ph * Math.PI) * 1.4); s.rotation.y = t * 3 + i;
  });
}
// raios de luz divina
const rayM = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const rays = new THREE.Group(); scene.add(rays);
for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9 + i * 0.12, 0.12 + i * 0.03, 14, 24, 1, true), rayM); m.position.set((i - 2.5) * 0.25, 7.3, -1.6); m.rotation.z = (i - 2.5) * 0.08; rays.add(m); }

// =========================================================
//   MUNDO (um único vale — todas as cenas acontecem nele)
// =========================================================
const world = new THREE.Group(); scene.add(world);
add(world, CYL, M(0xa8c66c, 1), [0, -0.05, 0], [140, 0.1, 140]);
add(world, BOX, M(0xd8c08a, 1), [0, -0.01, 0], [30, 0.04, 5]);
for (const s of [-1, 1]) {
  add(world, SPH, M(0x8fb75a, 1), [s * 19, -2.2, -3], [10, 4.2, 14]);
  add(world, SPH, M(0x86ae55, 1), [s * 26, -3, -18], [16, 7, 14]);
}
// riacho com pedras
const brook = add(world, BOX, M(0x5fb7e0, 0.08, 0.1, { emissive: 0x1d6a8f, emissiveIntensity: 0.25 }), [0, 0.0, 5.2], [40, 0.03, 1.4]);
for (let i = 0; i < 40; i++) add(world, new THREE.DodecahedronGeometry(1, 0), M(0xa9adb0, 0.7), [(RND() - 0.5) * 30, 0.03, 4.4 + RND() * 1.6], [0.08 + RND() * 0.1, 0.05, 0.08 + RND() * 0.1]);
// tendas: Israel (esquerda) e filisteus (direita)
function tent(x, z, col, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); world.add(g);
  add(g, new THREE.ConeGeometry(1.3, 1.8, 4, 1), M(col, 0.9), [0, 0.9, 0], [1, 1, 1], [0, Math.PI / 4, 0]);
  add(g, BOX, M(0x3a2a1a, 1), [0, 0.45, 0.9], [0.4, 0.7, 0.05]);
  add(g, CYL, M(0x7a5233, 0.8), [0, 2.0, 0], [0.03, 0.6, 0.03]);
  add(g, BOX, M(col === 0xeee2c6 ? 0x2f6fd0 : 0x2b2b2b, 0.8), [0.18, 2.15, 0], [0.32, 0.2, 0.01]);
}
[[-14, -6], [-17, -3], [-13, -10], [-18, -9], [-21, -5]].forEach(([x, z], i) => tent(x, z, i % 2 ? 0xeee2c6 : 0xd9c39a, 1.3));
[[14, -6], [17, -3], [13, -10], [18, -9], [21, -5]].forEach(([x, z], i) => tent(x, z, i % 2 ? 0xb3262e : 0x7a1f2a, 1.3));
// oliveiras e pedras
function olive(x, z, s = 1) {
  add(world, CYL, M(0x6b5240, 0.9), [x, 0.6 * s, z], [0.12 * s, 1.2 * s, 0.12 * s], [0, 0, 0.15]);
  for (let i = 0; i < 4; i++) add(world, SPH, M([0x7b9a58, 0x8aa765][i % 2], 0.9), [x + (i - 1.5) * 0.35 * s, 1.5 * s + (i % 2) * 0.2 * s, z + (i % 2 - 0.5) * 0.3], [0.55 * s, 0.38 * s, 0.5 * s]);
}
olive(-6, -6, 1.3); olive(7, -7, 1.4); olive(-10, 3, 1.1); olive(11, 2, 1.2); olive(-3, -12, 1.5); olive(4, 10, 1.2); olive(-41, 1, 1.5); olive(-45, 15, 1.3);
for (let i = 0; i < 26; i++) add(world, new THREE.DodecahedronGeometry(1, 0), M(0xb8aa92, 0.9), [(RND() - 0.5) * 50, 0.1, (RND() - 0.5) * 30], [0.2 + RND() * 0.4, 0.15 + RND() * 0.3, 0.2 + RND() * 0.4]);
// montanhas ao longe e nuvens
for (let i = 0; i < 9; i++) { const m = add(world, new THREE.ConeGeometry(14 + (i % 3) * 5, 12 + (i % 4) * 4, 7), M(0x9fb5c9, 1), [-70 + i * 18, 4, -60 - (i % 2) * 10]); m.castShadow = false; }
const cloudM = M(0xffffff, 1);
[[-20, 20, -45, 2.2], [15, 24, -50, 2.8], [35, 17, -38, 1.8], [-40, 18, -30, 2]].forEach(([x, y, z, s]) => { for (let i = 0; i < 4; i++) { const m = add(world, SPH, cloudM, [x + i * 1.3 * s, y + (i % 2) * 0.5 * s, z], [1.3 * s, 0.85 * s, 0.85 * s]); m.castShadow = false; } });
// pasto (onde Davi cuida das ovelhas): flores
const flowerCols = [0xff7aa2, 0xffd166, 0xffffff, 0xb983ff];
for (let i = 0; i < 70; i++) add(world, SPH, M(flowerCols[i % 4], 0.6), [-34 + (RND() - 0.5) * 14, 0.06, 8 + (RND() - 0.5) * 10], [0.07, 0.07, 0.07]);
// TENDA DO REI (interior) — em outro ponto do mapa
const tentIn = new THREE.Group(); tentIn.position.set(0, 0, 80); scene.add(tentIn);
{
  const stripes = textTex((g, W, H) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#c43a3a' : '#f3e2c0'; g.fillRect(i * 32, 0, 32, H); } }, 512, 64);
  stripes.wrapS = THREE.RepeatWrapping; stripes.repeat.set(3, 1);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 5, 40, 1, true), new THREE.MeshStandardMaterial({ map: stripes, side: THREE.BackSide, roughness: 0.9 }));
  wall.position.y = 2.5; wall.receiveShadow = true; tentIn.add(wall);
  add(tentIn, CYL, M(0x9a7a52, 1), [0, -0.05, 0], [5, 0.1, 5]);
  add(tentIn, CYL, M(0xb3262e, 0.9), [0, 0.01, 0], [2.2, 0.02, 2.2]);
  add(tentIn, CYL, M(0xf2c14e, 0.9), [0, 0.015, 0], [1.9, 0.02, 1.9]);
  // trono
  add(tentIn, BOX, M(0x8b5a2b, 0.6), [-1.6, 0.35, -2.4], [1.0, 0.7, 0.8]);
  add(tentIn, BOX, M(0x8b5a2b, 0.6), [-1.6, 1.1, -2.75], [1.0, 1.5, 0.12]);
  add(tentIn, SPH, M(0xf2c14e, 0.25, 1), [-1.6, 1.9, -2.75], [0.12, 0.12, 0.12]);
  // tochas
  for (const s of [-1, 1]) { add(tentIn, CYL, M(0x5a3a1a, 0.8), [s * 2.4, 0.9, -3.4], [0.05, 1.8, 0.05]); add(tentIn, SPH, M(0xffb347, 0.3, 0, { emissive: 0xff8c1a, emissiveIntensity: 2 }), [s * 2.4, 1.9, -3.4], [0.12, 0.18, 0.12]); }
}

// ---------- detalhes de ambiente ----------
const birds = [];
for (let i = 0; i < 6; i++) {
  const b = new THREE.Group();
  const wm = M(0x2b2b33, 0.8);
  const w1 = add(b, BOX, wm, [0.18, 0, 0], [0.36, 0.02, 0.1]), w2 = add(b, BOX, wm, [-0.18, 0, 0], [0.36, 0.02, 0.1]);
  add(b, SPH, wm, [0, 0, 0], [0.06, 0.05, 0.14]);
  b.userData = { w1, w2 }; scene.add(b); birds.push(b);
}
function updateBirds(on, t, center = V(0, 0, 0)) {
  birds.forEach((b, i) => {
    b.visible = on; if (!on) return;
    const x = ((t * (2.2 + i * 0.25) + i * 9) % 60) - 30;
    b.position.set(center.x + x, center.y + 9 + (i % 3) * 1.2 + Math.sin(t * 1.5 + i) * 0.4, center.z - 10 - (i % 2) * 4);
    b.rotation.y = Math.PI / 2;
    const f = Math.sin(t * 9 + i) * 0.6;
    b.userData.w1.rotation.z = f; b.userData.w2.rotation.z = -f;
    b.userData.w1.position.y = b.userData.w2.position.y = f * 0.08;
  });
}
const flies2 = [];
const bfCols = [0xffd166, 0xff8fb1, 0x9ad0ff, 0xffffff];
for (let i = 0; i < 5; i++) {
  const b = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: bfCols[i % 4], side: THREE.DoubleSide, roughness: 0.6 });
  const w1 = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), m), w2 = w1.clone();
  w1.position.x = 0.06; w2.position.x = -0.06; b.add(w1, w2); b.userData = { w1, w2 };
  scene.add(b); flies2.push(b);
}
function updateButterflies(on, t, c) {
  flies2.forEach((b, i) => {
    b.visible = on; if (!on) return;
    const a = t * (0.6 + i * 0.1) + i * 1.3;
    b.position.set(c.x + Math.cos(a) * (1.8 + i * 0.3), 0.6 + 0.4 * Math.sin(t * 2 + i) + (i % 2) * 0.4, c.z + Math.sin(a) * 1.4 - 0.4);
    b.rotation.y = -a;
    const f = Math.sin(t * 22 + i) * 1.1;
    b.userData.w1.rotation.y = f; b.userData.w2.rotation.y = -f;
  });
}
{   // capim
  const N = 900, grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.28, 4), M(0x7ea84e, 0.9), N);
  const r = rng(31), d = new THREE.Object3D(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const inPasture = i < 300;
    const x = inPasture ? -34 + (r() - 0.5) * 16 : (r() - 0.5) * 40, z = inPasture ? 8 + (r() - 0.5) * 12 : (r() - 0.5) * 22;
    const skip = !inPasture && (Math.abs(z) < 2.7 || (z > 4.3 && z < 6.1));
    d.position.set(x, skip ? -5 : 0.12, z); d.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4); d.scale.setScalar(0.7 + r() * 0.8);
    d.updateMatrix(); grass.setMatrixAt(i, d.matrix);
    grass.setColorAt(i, col.setHSL(0.23 + r() * 0.05, 0.45, 0.38 + r() * 0.12));
  }
  grass.receiveShadow = true; world.add(grass);
}
const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({
  map: textTex((g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.35, 'rgba(255,190,110,1)'); gr.addColorStop(0.5, 'rgba(255,150,80,.5)'); gr.addColorStop(1, 'rgba(255,140,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }, 256, 256),
  transparent: true, depthWrite: false, fog: false }));
sunDisc.scale.set(16, 16, 1); scene.add(sunDisc);

// =========================================================
//   OVERLAYS
// =========================================================
const $ = id => document.getElementById(id);
const el = { cap: $('caption'), title: $('title'), flash: $('flash'), tint: $('tint'), stones: $('stones'), cta: $('cta'), bars: $('bars') };
const show = (e, o, tf = '') => { e.style.opacity = o; e.style.transform = tf; };
const capData = TL.segments.map((s, i) => {
  const words = s.caption.split(/\s+/);
  const w = words.map(x => x.length + 2); const tot = w.reduce((a, b) => a + b, 0);
  let acc = 0; const times = w.map(x => { const st = acc / tot; acc += x; return st; });
  const next = TL.segments[i + 1];
  return { ...s, words, times, until: next ? next.start - 0.05 : DUR };
});
let lastCap = '';
function updateCaption(t) {
  const seg = capData.find(s => t >= s.start - 0.08 && t < s.until);
  if (!seg) { if (lastCap) { el.cap.innerHTML = ''; lastCap = ''; } return; }
  const f = (t - seg.start) / (seg.end - seg.start);
  let idx = -1; seg.times.forEach((st, i) => { if (f >= st) idx = i; });
  if (f > 1) idx = seg.words.length;
  const key = seg.id + idx; if (key === lastCap) return; lastCap = key;
  el.cap.innerHTML = seg.words.map((w, i) => `<span class="${i === idx ? 'on' : ''}">${w}</span>`).join(' ');
}
function flashAt(t, times, d = 0.2, max = 0.8) {
  let f = 0; for (const x of times) if (t >= x && t < x + d) f = Math.max(f, 1 - (t - x) / d);
  el.flash.style.opacity = Math.max(parseFloat(el.flash.style.opacity || 0), f * max);
}

// =========================================================
//   LUZ / CÂMERA
// =========================================================
function lights(p, k = 1) {
  gold.intensity = 0; spot.intensity = 0; lamp.intensity = 0; fill.intensity = 0.6; rim.color.set(0xa9cfff);
  scene.fog = new THREE.Fog(0xcfe6f2, 40, 140); renderer.toneMappingExposure = 1.05;
  if (p === 'day') {
    scene.background = new THREE.Color(0x8ecdf0); scene.fog.color.set(0xcfe6f2);
    hemi.color.set(0xdff0ff); hemi.groundColor.set(0x8a7a4a); hemi.intensity = 1.0;
    sun.color.set(0xfff0d0); sun.intensity = 2.5; rim.intensity = 1.0;
  } else if (p === 'drama') {     // abertura e medo
    scene.background = new THREE.Color(0x6f88a8); scene.fog = new THREE.Fog(0x8a9db5, 18, 90);
    hemi.color.set(0xb0c4dc); hemi.groundColor.set(0x4a4030); hemi.intensity = 0.65;
    sun.color.set(0xffd2a0); sun.intensity = 2.0; rim.intensity = 2.0; rim.color.set(0xffb070);
  } else if (p === 'tent') {
    scene.background = new THREE.Color(0x3a2418); scene.fog = null;
    hemi.color.set(0xffd9b0); hemi.groundColor.set(0x5a3a22); hemi.intensity = 0.8;
    sun.color.set(0xffc890); sun.intensity = 1.4; rim.intensity = 1.2; rim.color.set(0xffa860);
    lamp.intensity = 6; lamp.color.set(0xffa040);
  } else if (p === 'sunset') {
    scene.background = new THREE.Color(0xf6a26b); scene.fog = new THREE.Fog(0xf3b07a, 25, 110);
    hemi.color.set(0xffd9b0); hemi.groundColor.set(0x6a4a3a); hemi.intensity = 0.85;
    sun.color.set(0xffa860); sun.intensity = 2.4; rim.intensity = 2.0; rim.color.set(0xff9a5a);
  } else if (p === 'glory') {
    scene.background = new THREE.Color(0x9fd6f5); scene.fog.color.set(0xd9eef8);
    hemi.color.set(0xfff6dc); hemi.groundColor.set(0x8a7a4a); hemi.intensity = 1.15;
    sun.color.set(0xfff0c0); sun.intensity = 2.8; rim.intensity = 1.6; rim.color.set(0xffd27a);
  }
}
function sunAt(target, off = V(-7, 12, 9)) {
  sun.target.position.copy(target); sun.position.copy(target).add(off);
  rim.target.position.copy(target); rim.position.copy(target).add(V(6, 5, -8));
}
function cam(pos, look, fov = 40, shake = 0, t = 0) {
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.copy(pos);
  if (shake) camera.position.add(V(Math.sin(t * 61) * shake, Math.sin(t * 47 + 1) * shake, Math.sin(t * 53) * shake * 0.5));
  camera.lookAt(look);
  fill.position.copy(camera.position).add(V(1.5, 2.5, 0)); fill.target.position.copy(look);
}
const headPos = c => { c.root.updateMatrixWorld(true); goliasPivot.updateMatrixWorld(true); return c.head.getWorldPosition(V(0, 0, 0)); };
const segFrac = (t, id) => (t - S[id].start) / (S[id].end - S[id].start);

// =========================================================
//   CENAS
// =========================================================
const GOL = V(2.6, 0, 0);       // posição do Golias no vale
function hideAll() {
  world.visible = true; tentIn.visible = false;
  for (const h of humans) { h.root.visible = false; h.root.position.set(0, 0, 0); h.root.rotation.set(0, 0, 0); }
  golias.root.scale.setScalar(2.6); goliasPivot.position.copy(GOL); goliasPivot.rotation.set(0, 0, 0);
  golias.root.rotation.y = -Math.PI / 2; golias.root.visible = false;
  sheep.forEach(s => s.visible = false); stones.forEach(s => s.visible = false); flyStone.visible = false; trail.forEach(m => m.visible = false);
  star.visible = false; updateDust(null); updateSparks(false); updateSling(null); rayM.opacity = 0;
  davi.acc.armor.visible = false; davi.acc.helm.visible = false; davi.acc.staff.visible = false; davi.acc.bag.visible = true;
  canvas.style.filter = '';
  updateBirds(false); updateButterflies(false); sunDisc.visible = false;
}
function spearsUp(list) { for (const s of list) { const a = s.arms[0]; s.spear.rotation.set(-(a.sh.rotation.x + a.el.rotation.x), 0, -a.sh.rotation.z); } }
function soldierLine(t, mood, o = {}) {
  soldiers.forEach((s, i) => {
    s.root.visible = true;
    const back = o.back ? eo(P(t, o.back + i * 0.05, o.back + 0.8)) * 0.9 : 0;
    s.root.position.set(-7.2 - (i % 2) * 0.9 - back, 0, -3 + i * 1.0);
    s.root.rotation.y = Math.PI / 2;
    if (o.cheer) {
      const j = Math.abs(Math.sin(t * 7 + i)) * 0.35;
      s.root.position.y = j;
      hpose(s, { t, open: 0.7, smile: 1, brow: -0.3, arms: [[[-2.9 + Math.sin(t * 7 + i) * 0.2, 0, 0.2], -0.2], [[-0.6, 0, -0.3], -1.2]], head: [-0.2, 0, 0] });
    } else {
      hpose(s, { t, eye: 1.15, open: 0.2, smile: -0.6, brow: -0.9, look: [0, 0.3], arms: [[[-0.3, 0, 0.15], -0.8], [[-1.1, 0, -0.2], -0.9]], head: [-0.25 + Math.sin(t * 20 + i) * 0.02, 0, 0], body: [0.05, 0, Math.sin(t * 23 + i) * 0.02] });
    }
  });
  spearsUp(soldiers);
}
function philistineLine(t) {
  philistines.forEach((p, i) => {
    p.root.visible = true; p.root.position.set(9 + (i % 2) * 0.9, 0, -2.5 + i * 1.0); p.root.rotation.y = -Math.PI / 2;
    hpose(p, { t, open: 0.3 + 0.3 * Math.abs(Math.sin(t * 5 + i)), smile: 0.6, brow: 0.6, arms: [[[-2.6 + Math.sin(t * 6 + i) * 0.3, 0, 0.2], -0.3], [[0.1, 0, -0.1], -0.2]] });
  });
}
function goliasPose(t, o = {}) {
  golias.root.visible = true;
  hpose(golias, { t, brow: 0.9, smile: -0.2, eye: 1, arms: [[[-0.5, 0, 0.25], -1.1], [[0.05, 0, -0.35], -0.3]], ...o });
  const a0 = golias.arms[0];
  golias.spear.rotation.set(-(a0.sh.rotation.x + a0.el.rotation.x) + 0.15, 0, -a0.sh.rotation.z);
}

// 1) abertura: gigante visto de baixo
function shot1(t) {
  lights('drama'); sunAt(GOL, V(-6, 6, 8));
  const k = sm(P(t, 0, S.d2.start));
  const walk = P(t, 0, 1.6);
  goliasPivot.position.set(lerp(4.4, 2.6, eo(walk)), 0, 0);
  goliasPose(t, { open: 0.15, head: [0.15, 0.2, 0], look: [0.2, 0.25], legs: walk < 1 ? walkLegs(t, 4, 0.35) : null });
  updateDust(0.15, t, V(goliasPivot.position.x - 0.5, 0, 0), 2);
  soldiers.slice(0, 3).forEach((s, i) => {
    s.root.visible = true; s.root.position.set(-1.2 + i * 0.9, 0, 3.2 + (i % 2) * 0.4); s.root.rotation.y = Math.PI * 0.85;
    hpose(s, { t, eye: 1.2, open: 0.3, smile: -0.7, brow: -1, look: [0, 0.4], head: [-0.45, 0, 0], arms: [[[-0.3, 0, 0.15], -0.8], [[-1.1, 0, -0.2], -0.9]], body: [0, 0, Math.sin(t * 25 + i) * 0.02] });
  });
  const shake = (pulse(t, 0.1, 0.4) + pulse(t, 0.9, 0.4)) * 0.05;
  cam(V(lerp(-1.6, -0.6, k), lerp(0.6, 1.0, k), lerp(7.5, 6.2, k)), V(2.4, lerp(4.6, 4.2, k), 0), 42, shake, t);
  const tk = sm(P(t, 0.3, 1.0)) * (1 - sm(P(t, 3.6, 4.4)));
  show(el.title, tk, `translateY(${(1 - tk) * 20}px)`);
}
// 2) vale visto de cima
function shot2(t) {
  lights('day'); sunAt(V(0, 0, 0), V(-10, 16, 10));
  const k = sm(P(t, S.d2.start - 0.3, S.d3.start));
  goliasPose(t, { arms: [[[-2.6, 0, 0.3], -0.3], [[-0.4, 0, -0.25], -1.0]], open: 0.5 + 0.3 * Math.sin(t * 6) });
  soldierLine(t); philistineLine(t);
  cam(V(lerp(-5, 5, k), lerp(21, 17, k), lerp(30, 27, k)), V(0, 0, -3), 48);
}
// 3) Golias desafia / soldiers com medo
function shot3(t) {
  const f = segFrac(t, 'd3');
  if (f < 0.62) {
    lights('drama'); sunAt(GOL, V(-6, 8, 8));
    goliasPose(t, { talk: 1, brow: 1, smile: -0.4, head: [-0.1, 0, Math.sin(t * 3) * 0.06], arms: [[[-2.3 + Math.sin(t * 3) * 0.15, 0, 0.2], -0.5], [[0.05, 0, -0.4], -0.3]] });
    const hp = headPos(golias);
    const k = sm(P(t, S.d3.start - 0.3, S.d3.start + 2));
    cam(V(hp.x - 6.8 + k * 0.8, hp.y - lerp(2.6, 1.8, k), hp.z + 2.4), V(hp.x, hp.y - 1.0, hp.z), 40, 0.012, t);
  } else {
    lights('drama'); sunAt(V(-7.5, 0, 0), V(6, 8, 8));
    soldierLine(t, 'fear', { back: S.d3.start + (S.d3.end - S.d3.start) * 0.66 });
    goliasPose(t, { talk: 0.4 });
    cam(V(-4.0, 1.7, 3.6), V(-7.8, 1.4, -0.3), 42);
  }
  flashAt(t, [S.d3.start + (S.d3.end - S.d3.start) * 0.62], 0.15, 0.5);
}
// 4) Davi, o pastor
const PAST = V(-34, 0, 8);
function shot4(t) {
  lights('glory'); sunAt(PAST, V(-6, 10, 9));
  davi.root.visible = true; davi.acc.staff.visible = true;
  davi.root.position.copy(PAST); davi.root.rotation.y = 0.3;
  const f = segFrac(t, 'd4');
  hpose(davi, { t, smile: f > 0.55 ? 0.3 : 0.7, brow: f > 0.55 ? 0.5 : 0, look: [f > 0.55 ? 0.4 : 0, 0], head: [0, f > 0.55 ? 0.5 : 0.1, 0], arms: [[[0.1, 0, 0.12], -0.3], [[-0.3, 0, -0.15], -1.0]] });
  sheep.forEach((s, i) => {
    s.visible = true; const a = i * 1.05 + 0.4;
    s.position.set(PAST.x + Math.cos(a) * (1.5 + (i % 2) * 0.7), 0, PAST.z - 1.0 - Math.abs(Math.sin(a)) * 0.9);
    s.rotation.y = a + Math.PI / 2 + Math.sin(t + i) * 0.2;
    s.userData.head.rotation.x = 0.3 + Math.sin(t * 2 + i) * 0.3;
  });
  const k = sm(P(t, S.d4.start - 0.3, S.d5.start));
  const a = lerp(-0.4, 0.5, k);
  cam(V(PAST.x + Math.sin(a) * 5.4, lerp(2.4, 2.1, k), PAST.z + Math.cos(a) * 5.4), V(PAST.x, 1.15, PAST.z), 40);
}
// 5) todos veem um gigante / Davi vê Deus com ele
function shot5(t) {
  const f = segFrac(t, 'd5');
  if (f < 0.5) {
    lights('drama'); sunAt(V(-7.5, 0, 0), V(6, 8, 8));
    soldierLine(t);
    goliasPose(t, { talk: 0.3 });
    const k5 = sm(P(t, S.d5.start - 0.2, S.d5.start + 2.5));
    cam(V(-3.2, lerp(1.4, 2.2, k5), lerp(5.2, 4.6, k5)), V(-7.4, 1.5, -0.2), 40);
  } else {
    lights('glory'); const p = V(-4.5, 0, 1.0); sunAt(p, V(-4, 12, 6));
    davi.root.visible = true; davi.root.position.copy(p); davi.root.rotation.y = 0.5;
    const k = sm(P(t, S.d5.start + (S.d5.end - S.d5.start) * 0.5, S.d6.start));
    hpose(davi, { t, smile: 0.6, brow: -0.2, look: [0, 0.6], head: [-0.45, 0, 0], arms: [[[-0.4, 0, 0.5], -0.4], [[-0.4, 0, -0.5], -0.4]] });
    rays.position.set(p.x, 0, p.z); rayM.opacity = 0.06 * sm(P(t, S.d5.start + (S.d5.end - S.d5.start) * 0.45, S.d5.start + (S.d5.end - S.d5.start) * 0.7));
    rays.rotation.y = t * 0.2;
    gold.intensity = 6 * rayM.opacity / 0.06; gold.position.copy(headPos(davi)).add(V(0, 2, 1.5));
    updateSparks(true, t, headPos(davi).add(V(0, 0.3, 0)), 1.0);
    const hp = headPos(davi);
    cam(V(hp.x + 1.0, hp.y - lerp(0.9, 0.7, k), hp.z + lerp(3.4, 2.8, k)), V(hp.x, hp.y + 0.1, hp.z), 42);
  }
  flashAt(t, [S.d5.start + (S.d5.end - S.d5.start) * 0.5], 0.25, 0.7);
}
// 6) a armadura do rei
function shot6(t) {
  world.visible = false; tentIn.visible = true;
  lights('tent'); const base = V(0, 0, 80); sunAt(base, V(-3, 8, 6)); lamp.position.set(0, 3, 80);
  const s = S.d6, f = segFrac(t, 'd6');
  saul.root.visible = true; saul.root.position.set(-0.55, 0, 80); saul.root.rotation.y = 0.55;
  davi.root.visible = true; davi.root.position.set(0.55, 0, 80.1); davi.root.rotation.y = -0.55;
  const wear = f > 0.45 && f < 1.15;
  const off = sm(P(t, s.end - 0.1, s.end + 0.3));
  davi.acc.armor.visible = davi.acc.helm.visible = wear || (t > s.end - 0.1 && t < S.d7.start);
  davi.acc.bag.visible = !davi.acc.armor.visible;
  davi.acc.helm.position.set(off * 0.6, 0.02 + off * 0.8, off * 0.3); davi.acc.helm.rotation.z = off * 1.2;
  davi.acc.armor.position.set(off * 0.3, -off * 0.2, 0); davi.acc.armor.rotation.z = -off * 0.4;
  const wob = wear ? Math.sin(t * 7) * 0.12 : 0;
  davi.root.rotation.z = wob; davi.root.position.x += wob * 0.4;
  hpose(saul, { t, talk: f < 0.45 ? 0.7 : 0, smile: 0.4, brow: 0.2, arms: [[[f < 0.45 ? -1.2 : 0.05, 0, 0.1], f < 0.45 ? -0.4 : -0.15], [[-0.3, 0, -0.1], -0.8]], head: [0, 0, 0] });
  hpose(davi, { t, eye: wear ? 1.2 : 1, open: wear ? 0.4 : 0, smile: wear ? -0.6 : 0.3, brow: wear ? -0.8 : 0, arms: wear ? [[[-0.3, 0, 0.9 + wob], -0.5], [[-0.3, 0, -0.9 + wob], -0.5]] : null, legs: wear ? [wob * 2, -wob * 2] : null, head: [0, 0, wob * 0.6] });
  // armadura nas mãos do rei antes
  const k = sm(P(t, s.start - 0.3, s.end));
  cam(V(lerp(0.2, 0.1, k), lerp(1.9, 1.7, k), lerp(86.2, 85.4, k)), V(0, 1.2, 80), 40, wear ? 0.006 : 0, t);
}
// 7) cinco pedras e a funda
function shot7(t) {
  lights('day'); const p = V(-1.5, 0, 4.5); sunAt(p);
  const s = S.d7;
  davi.root.visible = true; davi.root.position.copy(p); davi.root.rotation.y = 0.2;
  const pick = (t - s.start - 1.3) / 0.32;
  const n = clamp(Math.floor(pick) + 1, 0, 5);
  const bend = t > s.start + 1.0 ? 0.5 + 0.1 * Math.sin(t * 20) : sm(P(t, s.start + 0.5, s.start + 1.0)) * 0.5;
  davi.body.position.y = -bend * 0.25;
  hpose(davi, { t, smile: 0.5, brow: 0.3, look: [0, -0.4], head: [0.4, 0, 0], body: [bend, 0, 0],
    arms: [[[-0.6 - 0.4 * Math.abs(Math.sin(t * 9)), 0, 0.2], -0.4], [[-1.0, 0, -0.3], -1.2]], legs: [-bend * 0.8, -bend * 0.8] });
  davi.body.rotation.x = bend;
  updateSling('hang', t);
  stones.forEach((st, i) => {
    st.visible = true;
    if (i < n) { const hp = davi.arms[1].hand.getWorldPosition(V(0, 0, 0)); st.position.copy(hp).add(V(-0.05 + (i % 3) * 0.05, 0.06 + Math.floor(i / 3) * 0.05, 0.05)); }
    else st.position.set(p.x + 0.3 + i * 0.12, 0.05, p.z + 0.55 + (i % 2) * 0.1);
  });
  const k = sm(P(t, s.start - 0.3, S.d8.start));
  cam(V(p.x + lerp(1.9, 1.5, k), lerp(1.7, 1.5, k), p.z + lerp(3.8, 3.3, k)), V(p.x + 0.2, 0.9, p.z), 40);
  // contador de pedras
  show(el.stones, sm(P(t, s.start + 1.0, s.start + 1.3)) * (1 - sm(P(t, S.d8.start - 0.3, S.d8.start))));
  el.stones.querySelectorAll('i').forEach((d, i) => d.className = i < n ? 'on' : '');
}
// 8) Golias ri
function shot8(t) {
  lights('day'); sunAt(V(0, 0, 0));
  const s = S.d8;
  goliasPose(t, { open: 0.9, smile: 1, brow: -0.2, lid: 0.55, head: [-0.35 + Math.sin(t * 14) * 0.08, 0, Math.sin(t * 7) * 0.05], body: [Math.sin(t * 14) * 0.03, 0, 0], arms: [[[-0.6, 0, 0.3], -1.6], [[-0.8, 0, -0.6], -1.6]] });
  davi.root.visible = true;
  const w = P(t, s.start - 0.2, s.end + 0.3);
  davi.root.position.set(lerp(-7, -4.5, w), 0, 0.4); davi.root.rotation.y = Math.PI / 2;
  hpose(davi, { t, smile: 0, brow: 0.6, legs: walkLegs(t), arms: walkArms(t) });
  davi.root.position.y = Math.abs(Math.sin(t * 7)) * 0.04;
  updateSling('hang', t);
  // por cima do ombro do gigante
  const k = sm(P(t, s.start - 0.3, S.d9.start));
  cam(V(lerp(5.4, 5.0, k), lerp(6.8, 6.4, k), lerp(-3.0, -2.6, k)), V(-3.5, 0.6, 0.6), 44);
}
// 9) Davi não recua
function shot9(t) {
  lights('glory'); sunAt(V(-3.6, 0, 0.4), V(-6, 9, 6));
  const s = S.d9;
  goliasPose(t, { open: 0.3, smile: 0.4 });
  davi.root.visible = true;
  davi.root.position.set(lerp(-4.5, -3.6, P(t, s.start - 0.3, S.d10.start)), 0, 0.4); davi.root.rotation.y = Math.PI / 2;
  hpose(davi, { t, smile: -0.1, brow: 0.85, legs: walkLegs(t, 5, 0.35), arms: walkArms(t, 5, 0.3), head: [-0.08, 0, 0] });
  updateSling('hang', t);
  const hp = headPos(davi);
  const k = sm(P(t, s.start - 0.3, S.d10.start));
  cam(V(hp.x + lerp(1.6, 2.0, k), 0.45, hp.z + lerp(1.4, 1.8, k)), V(hp.x - 0.2, hp.y - 0.15, hp.z), 44);
  canvas.style.filter = 'contrast(1.06) saturate(1.1)';
}
// 10) gira a funda e lança
function shot10(t) {
  lights('glory'); const p = V(-3.4, 0, 0.4); sunAt(p, V(-6, 9, 6));
  const s = S.d10, d = s.end - s.start;
  const tLoad = s.start + d * 0.15, tSpin = s.start + d * 0.42, tRel = s.end - 0.15;
  goliasPose(t, { open: 0.2, smile: 0.3 });
  davi.root.visible = true; davi.root.position.copy(p); davi.root.rotation.y = Math.PI / 2;
  const spinning = t >= tSpin && t < tRel;
  const after = t >= tRel;
  const up = sm(P(t, tSpin - 0.3, tSpin));
  const speed = 6 + 14 * P(t, tSpin, tRel);
  const ang = (t - tSpin) * speed;
  hpose(davi, { t, brow: 0.9, smile: -0.1, open: spinning ? 0.3 : 0, head: [-0.1, 0, 0],
    arms: after ? [[[-1.7, 0, 0.1], -0.05], [[0.3, 0, -0.4], -0.3]] : [[[lerp(-0.5, -2.9, up), 0, lerp(0.3, 0.2, up)], lerp(-1.0, -0.3, up)], [[-0.7, 0, -0.3], -1.1]],
    legs: [0.3, -0.25] });
  updateSling(spinning ? 'spin' : after ? 'hang' : 'hang', t, { angle: ang, stone: t >= tLoad && !after });
  const hp = headPos(davi);
  if (after) {
    // pedra voando (câmera lenta)
    const fly = P(t, tRel, S.d11.start + 0.35);
    flyStone.visible = true;
    const from = davi.arms[0].hand.getWorldPosition(V(0, 0, 0)), to = headPos(golias).add(V(-0.55, 0.32, 0));
    flyStone.position.copy(from.clone().lerp(to, fly)).add(V(0, Math.sin(fly * Math.PI) * 0.6, 0));
    flyStone.rotation.set(t * 20, t * 15, 0);
    trail.forEach((m, i) => { m.visible = true; const f2 = Math.max(0, fly - (i + 1) * 0.035); m.position.copy(from.clone().lerp(to, f2)).add(V(0, Math.sin(f2 * Math.PI) * 0.6, 0)); });
    cam(V(-0.5, 2.8, 15), V(-0.5, 2.5, 0), 46);
  } else {
    const k = sm(P(t, s.start - 0.3, tRel));
    cam(V(hp.x + lerp(1.0, 1.9, k), hp.y - lerp(0.6, 0.9, k), hp.z + lerp(3.4, 3.0, k)), V(hp.x - 0.1, hp.y + lerp(-0.1, 0.25, k), hp.z), 44, spinning ? 0.006 * P(t, tSpin, tRel) : 0, t);
  }
  if (spinning) canvas.style.filter = `contrast(1.08) saturate(1.15)`;
}
// 11) acerta a testa e o gigante cai
function shot11(t) {
  lights('glory'); sunAt(GOL, V(-6, 10, 8));
  const s = S.d11, hit = s.start + 0.35, fallEnd = s.end - 0.1;
  const fallK = P(t, hit + 0.5, fallEnd);
  const ang = Math.pow(fallK, 2.2) * (Math.PI / 2 - 0.12);
  goliasPivot.rotation.z = -ang;
  const dazed = t > hit;
  goliasPose(t, { eye: dazed ? 1.2 : 1, lid: dazed ? 0.3 : null, open: dazed ? 0.6 : 0.2, smile: dazed ? -0.3 : 0.3, brow: dazed ? -0.6 : 0.6, look: dazed ? [Math.sin(t * 20) * 0.3, 0.2] : [0, 0],
    arms: dazed ? [[[-0.9 - fallK, 0, 0.8], -0.3], [[-0.9 - fallK, 0, -0.8], -0.3]] : null, head: [-0.2 * fallK, 0, 0] });
  if (t < hit) {
    flyStone.visible = true;
    const to = headPos(golias).add(V(-0.55, 0.32, 0)), from = to.clone().add(V(-2.5, -0.8, 0));
    const fly = P(t, s.start - 0.4, hit);
    flyStone.position.copy(from.lerp(to, fly));
  }
  star.visible = t > hit && t < hit + 0.45;
  if (star.visible) { const sc = 0.3 + 0.7 * P(t, hit, hit + 0.15); star.scale.set(sc, sc, sc); star.position.copy(headPos(golias).add(V(-0.6, 0.35, 0))); star.material.rotation = t * 3; }
  updateDust(hit + 0.5 + (fallEnd - hit - 0.5) * 0.92, t, V(GOL.x + 3.5, 0, 0), 5);
  davi.root.visible = true; davi.root.position.set(-3.4, 0, 0.4); davi.root.rotation.y = Math.PI / 2;
  hpose(davi, { t, brow: 0.6, smile: 0, eye: 1.1, arms: [[[-1.7, 0, 0.1], -0.05], [[0.3, 0, -0.4], -0.3]], legs: [0.3, -0.25] });
  updateSling('hang', t);
  const impact = fallEnd;
  const shake = pulse(t, hit, 0.3) * 0.05 + pulse(t, impact - 0.05, 0.6) * 0.18;
  if (t < hit + 0.6) {
    const hp = headPos(golias);
    cam(V(hp.x - 2.2, hp.y - 0.3, hp.z + 1.6), V(hp.x - 0.3, hp.y + 0.1, hp.z), 40, shake, t);
  } else {
    const k = sm(P(t, hit + 0.6, s.end + 0.5));
    cam(V(lerp(-6.5, -7.5, k), lerp(2.6, 3.2, k), lerp(7.5, 9.5, k)), V(lerp(1.5, 2.5, k), lerp(2.6, 0.8, k), 0), 46, shake, t);
  }
  flashAt(t, [hit], 0.18, 0.9);
}
// 12) vitória!
function shot12(t) {
  lights('glory'); const p = V(-3.4, 0, 0.4); sunAt(p, V(-6, 10, 8));
  const s = S.d12;
  goliasPivot.rotation.z = -(Math.PI / 2 - 0.12);
  goliasPose(t, { lid: 1, open: 0.3, arms: [[[-1.9, 0, 0.8], -0.3], [[-1.9, 0, -0.8], -0.3]] });
  updateDust(S.d11.end - 0.1, t, V(GOL.x + 3.5, 0, 0), 5);
  davi.root.visible = true; davi.root.position.copy(p); davi.root.rotation.y = 0.9;
  const j = Math.abs(Math.sin(t * 5)) * 0.15;
  davi.root.position.y = j;
  hpose(davi, { t, smile: 1, open: 0.5, brow: -0.2, eye: 1.05, arms: [[[-2.9, 0, 0.2], -0.1], [[-0.2, 0, -0.5], -0.4]], head: [-0.15, 0, 0] });
  updateSling('hang', t);
  soldierLine(t, 'cheer', { cheer: true });
  soldiers.forEach((x, i) => { x.root.position.x += 1.5; });
  rays.position.set(p.x, 0, p.z); rayM.opacity = 0.05; rays.rotation.y = t * 0.2;
  updateSparks(true, t, headPos(davi).add(V(0, 0.2, 0)), 1.2);
  const k = sm(P(t, s.start - 0.3, S.d13.start));
  cam(V(lerp(-1.2, -0.4, k), lerp(1.2, 2.6, k), lerp(4.2, 6.5, k)), V(lerp(-3.4, -4.6, k), lerp(1.6, 1.4, k), 0.2), 44);
}
// 13) a lição — pôr do sol
function shot13(t) {
  lights('sunset'); sunAt(PAST, V(10, 5, -8));
  const s = S.d13;
  davi.root.visible = true; davi.acc.staff.visible = true;
  davi.root.position.copy(PAST); davi.root.rotation.y = 0.2;
  hpose(davi, { t, smile: 0.7, brow: -0.1, look: [0, 0.3], head: [-0.2, 0.3, 0], arms: [[[0.1, 0, 0.12], -0.3], [[-0.3, 0, -0.15], -1.0]] });
  sheep.forEach((sh, i) => {
    sh.visible = true; const a = i * 1.05 + 0.4;
    sh.position.set(PAST.x + Math.cos(a) * (1.5 + (i % 2) * 0.8), 0, PAST.z + Math.sin(a) * 1.2);
    sh.rotation.y = a + Math.PI / 2; sh.userData.head.rotation.x = 0.4 + Math.sin(t * 2 + i) * 0.3;
  });
  const k = sm(P(t, s.start - 0.3, S.d14.start));
  cam(V(PAST.x + lerp(-4.5, -2.6, k), lerp(1.4, 1.6, k), PAST.z + lerp(5.5, 4.0, k)), V(PAST.x + lerp(1, 0.2, k), lerp(2.2, 1.4, k), PAST.z), 42);
}
// 14) pergunta final
function shot14(t) {
  lights('sunset'); sunAt(PAST, V(10, 5, -8));
  const s = S.d14;
  davi.root.visible = true; davi.acc.staff.visible = true;
  davi.root.position.copy(PAST); davi.root.rotation.y = 0;
  hpose(davi, { t, smile: 1, talk: 0, brow: -0.2, eye: 1.05, arms: [[[-2.7 + Math.sin(t * 8) * 0.25, 0, 0.5], -0.4], [[-0.3, 0, -0.15], -1.0]] });
  sheep.forEach((sh, i) => {
    sh.visible = true; const a = i * 1.05 + 0.4;
    sh.position.set(PAST.x + Math.cos(a) * (1.5 + (i % 2) * 0.8), 0, PAST.z + Math.sin(a) * 1.2 - 0.6);
    sh.rotation.y = a + Math.PI / 2;
  });
  const hp = headPos(davi);
  const k = sm(P(t, s.start - 0.3, s.start + 1.2));
  cam(V(hp.x + 0.1, hp.y - 0.25, hp.z + lerp(4.2, 3.4, k)), V(hp.x, hp.y - 0.5, hp.z), 40);
  const ck = back(P(t, s.start + 0.4, s.start + 0.9));
  show(el.cta, clamp(ck * 2), `scale(${ck})`);
}

// =========================================================
function renderAt(t) {
  hideAll();
  el.flash.style.opacity = 0;
  for (const k of ['title', 'stones', 'cta']) show(el[k], 0);
  const g = S, b = id => g[id].start - 0.12;
  if (t < b('d2')) shot1(t);
  else if (t < b('d3')) shot2(t);
  else if (t < b('d4')) shot3(t);
  else if (t < b('d5')) shot4(t);
  else if (t < b('d6')) shot5(t);
  else if (t < b('d7')) shot6(t);
  else if (t < b('d8')) shot7(t);
  else if (t < b('d9')) shot8(t);
  else if (t < b('d10')) shot9(t);
  else if (t < g.d10.end - 0.15 + 0.5) shot10(t);
  else if (t < b('d12')) shot11(t);
  else if (t < b('d13')) shot12(t);
  else if (t < b('d14')) shot13(t);
  else shot14(t);
  if (world.visible) updateBirds(true, t, camera.position.clone().setY(0));
  if (t >= b('d4') && t < b('d5') || t >= b('d13')) updateButterflies(true, t, PAST);
  if (t >= b('d13')) { sunDisc.visible = true; sunDisc.position.set(PAST.x - 30, 6, PAST.z - 55); }
  flashAt(t, ['d2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd12', 'd13'].map(id => b(id)), 0.14, 0.45);
  // faixas de cinema na parte dramática
  const drama = t < b('d4') || (t > b('d8') && t < b('d12'));
  el.bars.style.opacity = drama ? 1 : 0;
  updateCaption(t);
  renderer.render(scene, camera);
}
window.renderAt = renderAt;
window.DURATION = DUR;
window.ready = true;
const q = new URLSearchParams(location.search);
if (q.has('t')) renderAt(parseFloat(q.get('t')));
