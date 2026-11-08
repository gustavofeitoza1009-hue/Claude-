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
//   CHIMPANZÉ (baseado na foto: pelo preto, rosto rosado,
//   orelhas grandes, olhos castanho-âmbar, lábio rosado,
//   barbinha branca no queixo)
// =========================================================
const skinM = M(0xb08a7e, 0.62); skinM.side = THREE.DoubleSide;
function makeChimp(o = {}) {
  const fur = M(o.fur ?? 0x2a282f, 0.9);
  const skin = skinM, skin2 = M(0xc49a8c, 0.55), earM = M(0x9e776b, 0.7), earIn = M(0x7a574d, 0.85);
  const lipM = M(0xc8807c, 0.4), dark = M(0x140c0c, 0.35), white = M(0xe6dfd6, 0.95);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  add(body, SPH, fur, [0, 0.75, 0], [0.45, 0.52, 0.38]);
  for (const s of [-1, 1]) add(body, SPH, fur, [s * 0.3, 1.0, -0.02], [0.23, 0.21, 0.23]);
  const neck = new THREE.Group(); neck.position.y = 1.18; body.add(neck);
  const head = new THREE.Group(); head.position.y = 0.24; neck.add(head);
  add(head, SPH, fur, [0, 0, -0.02], [0.38, 0.36, 0.36]);
  add(head, SPH, fur, [0, 0.26, -0.06], [0.2, 0.13, 0.2]);
  add(head, SPH, fur, [0.1, 0.22, -0.12], [0.16, 0.12, 0.16]);
  add(head, SPH, skin, [0, -0.02, 0.17], [0.28, 0.3, 0.2]);
  add(head, SPH, skin, [0, 0.12, 0.27], [0.27, 0.075, 0.12]);
  // olhos
  const eyes = [], lids = [], balls = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.103, 0.035, 0.345); head.add(e);
    const ball = new THREE.Group(); e.add(ball);
    add(ball, SPH, M(0x7d4a1e, 0.22), [0, 0, 0], [0.064, 0.064, 0.064]);
    add(ball, SPH, M(0x0b0606, 0.2), [0, 0, 0.034], [0.036, 0.036, 0.036]);
    const hl = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(0.02, 0.024, 0.058); hl.scale.setScalar(0.012); ball.add(hl);
    const lid = new THREE.Mesh(LID, skin); lid.scale.setScalar(0.069); e.add(lid);
    eyes.push(e); lids.push(lid); balls.push(ball);
  }
  // focinho, narinas, boca
  add(head, SPH, skin2, [0, -0.14, 0.33], [0.2, 0.155, 0.17]);
  for (const s of [-1, 1]) add(head, SPH, dark, [s * 0.04, -0.075, 0.488], [0.022, 0.014, 0.014]);
  add(head, SPH, skin2, [0, -0.205, 0.39], [0.16, 0.06, 0.09]);
  const mouth = new THREE.Group(); mouth.position.set(0, -0.245, 0.42); head.add(mouth);
  const inner = add(mouth, SPH, dark, [0, 0, 0], [0.09, 0.02, 0.05]);
  const lowLip = add(mouth, SPH, lipM, [0, -0.035, 0.0], [0.115, 0.05, 0.075]);
  add(head, SPH, white, [0, -0.335, 0.32], [0.12, 0.06, 0.08]);
  // orelhas grandes
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 0.37, 0.03, -0.02); g.rotation.y = s * 0.35; head.add(g);
    add(g, CYL, earM, [0, 0, 0], [0.155, 0.035, 0.165], [0, 0, Math.PI / 2]);
    add(g, CYL, earIn, [s * 0.016, 0, 0.01], [0.095, 0.03, 0.1], [0, 0, Math.PI / 2]);
  }
  // braços compridos
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.42, 1.02, 0); body.add(sh);
    add(sh, new THREE.CapsuleGeometry(0.12, 0.3, 6, 14), fur, [0, -0.25, 0]);
    const el = new THREE.Group(); el.position.y = -0.48; sh.add(el);
    add(el, new THREE.CapsuleGeometry(0.105, 0.28, 6, 14), fur, [0, -0.2, 0]);
    const hand = new THREE.Group(); hand.position.y = -0.42; el.add(hand);
    add(hand, SPH, skin, [0, 0, 0.02], [0.11, 0.13, 0.08]);
    add(hand, SPH, skin, [-s * 0.08, 0.04, 0.05], [0.04, 0.07, 0.04]);
    arms.push({ sh, el, hand, s });
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.22, 0.42, 0.05); body.add(hip);
    add(hip, new THREE.CapsuleGeometry(0.13, 0.22, 6, 14), fur, [0, -0.18, 0]);
    add(hip, SPH, skin, [0, -0.39, 0.08], [0.11, 0.06, 0.17]);
    legs.push(hip);
  }
  const c = { root, body, neck, head, eyes, lids, balls, inner, lowLip, arms, legs, acc: {} };

  // ---- acessórios ----
  if (o.shirt) {
    const sh = add(body, new THREE.SphereGeometry(1, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.64), M(o.shirt, 0.85, 0, { side: THREE.DoubleSide }), [0, 0.76, 0], [0.47, 0.54, 0.4]);
    c.acc.shirt = sh;
    for (const a of arms) add(a.sh, CYL, M(o.shirt, 0.85), [0, -0.12, 0], [0.145, 0.26, 0.145]);
  }
  if (o.tie) {
    add(body, BOX, M(o.tie, 0.5), [0, 0.88, 0.385], [0.09, 0.36, 0.03], [-0.28, 0, 0]);
    add(body, BOX, M(o.tie, 0.5), [0, 1.07, 0.33], [0.1, 0.07, 0.04], [-0.4, 0, 0]);
  }
  if (o.cap) {
    add(head, HEMI, M(o.cap, 0.7), [0, 0.1, -0.03], [0.39, 0.33, 0.39]);
    add(head, CYL, M(o.cap, 0.7), [0, 0.13, 0.33], [0.24, 0.025, 0.22]);
  }
  if (o.curlers) {
    const cols = [0xf48fb1, 0x81d4fa, 0xfff59d, 0xf48fb1, 0x81d4fa, 0xfff59d];
    cols.forEach((col, i) => {
      const a = -1.1 + i * 0.44;
      add(head, CYL, M(col, 0.5), [Math.sin(a) * 0.3, 0.27 + Math.cos(a) * 0.04, -0.05 + Math.cos(a * 2) * 0.05], [0.07, 0.2, 0.07], [0, 0, Math.PI / 2 + a * 0.6]);
    });
  }
  if (o.pearls) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      add(body, SPH, M(0xf7f1e6, 0.25, 0.1), [Math.sin(a) * 0.27, 1.13 - Math.cos(a) * 0.03 + (Math.cos(a) > 0 ? -0.06 : 0), Math.cos(a) * 0.24 + 0.04], [0.035, 0.035, 0.035]);
    }
  }
  if (o.rich) {
    const gl = new THREE.Group(); gl.position.set(0, 0.05, 0.42); head.add(gl);
    const lens = M(0x0d0d10, 0.12, 0.6);
    for (const s of [-1, 1]) add(gl, BOX, lens, [s * 0.105, 0, 0], [0.17, 0.1, 0.025]);
    add(gl, BOX, M(0xd4a017, 0.3, 1), [0, 0.02, 0], [0.06, 0.02, 0.02]);
    for (const s of [-1, 1]) add(gl, BOX, M(0x0d0d10, 0.3), [s * 0.22, 0.02, -0.18], [0.02, 0.02, 0.36]);
    const chain = new THREE.Group(); body.add(chain);
    const gold = M(0xe2b13c, 0.28, 1);
    add(chain, new THREE.TorusGeometry(0.3, 0.025, 10, 48), gold, [0, 1.1, 0.04], [1, 1, 1], [Math.PI / 2 - 0.45, 0, 0]);
    add(chain, CYL, gold, [0, 0.93, 0.36], [0.075, 0.025, 0.075], [Math.PI / 2 - 0.25, 0, 0]);
    c.acc.glasses = gl; c.acc.chain = chain;
  }
  if (o.briefcase) {
    const bc = new THREE.Group(); bc.position.set(0, -0.22, 0.02); arms[1].hand.add(bc);
    add(bc, BOX, M(0x5b3a24, 0.6), [0, -0.12, 0], [0.42, 0.3, 0.1]);
    add(bc, BOX, M(0xd4a017, 0.3, 1), [0, 0.06, 0], [0.12, 0.05, 0.03]);
  }
  // celular na mão direita
  const phone = new THREE.Group(); phone.position.set(-0.02, -0.1, 0.1); phone.rotation.set(-0.2, 0, 0); arms[0].hand.add(phone);
  add(phone, BOX, M(0x1d1f24, 0.3, 0.4), [0, 0, 0], [0.13, 0.25, 0.022]);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.225), new THREE.MeshBasicMaterial({ color: 0x9fe3c6 }));
  scr.position.z = 0.012; phone.add(scr);
  phone.visible = false; c.phone = phone; c.phoneScreen = scr;
  return c;
}

// pose básica, chamada todo quadro
function pose(c, o = {}) {
  const { talk = 0, t = 0, lid = null, eye = 1, look = [0, 0], head = [0, 0, 0], body = [0, 0, 0], arms = null, open = 0, legs = null } = o;
  // piscar automático
  const ph = (t * 0.37 + (c.seed || 0)) % 1;
  const autoBlink = ph > 0.955 ? Math.sin((ph - 0.955) / 0.045 * Math.PI) : 0;
  const L = lid == null ? autoBlink : lid;
  for (const l of c.lids) l.rotation.x = lerp(-0.85, 1.62, L);
  for (const b of c.balls) { b.scale.setScalar(eye); b.rotation.set(-look[1], look[0], 0); }
  const m = talk > 0 ? talk * (0.35 + 0.65 * Math.abs(Math.sin(t * 17 + Math.sin(t * 5) * 2))) : 0;
  const op = Math.max(m, open);
  c.inner.scale.set(0.09 + op * 0.02, 0.02 + op * 0.09, 0.05);
  c.lowLip.position.y = -0.035 - op * 0.085;
  c.head.rotation.set(head[0], head[1], head[2]);
  c.body.rotation.set(body[0], body[1], body[2]);
  const def = [[0.05, 0, 0.12], [0.05, 0, -0.12]];
  for (let i = 0; i < 2; i++) {
    const a = c.arms[i];
    const r = arms && arms[i] ? arms[i] : null;
    const sh = r ? r[0] : def[i];
    a.sh.rotation.set(sh[0], sh[1], sh[2]);
    a.el.rotation.set(r && r[1] ? r[1] : -0.15, 0, 0);
  }
  for (let i = 0; i < 2; i++) c.legs[i].rotation.set(legs ? legs[i] : 0, 0, 0);
}
function upright(obj, c) { const a = c.arms[0]; obj.rotation.set(-(a.sh.rotation.x + a.el.rotation.x), 0, -a.sh.rotation.z); }
const talkAmt = (t, ...ids) => ids.some(id => t >= S[id].start && t <= S[id].end) ? 1 : 0;


// =========================================================
//   GLOW UP — EP. 1
// =========================================================
const gold = new THREE.PointLight(0xffc94a, 0, 12, 1.5);
scene.add(gold);

// ---------- personagens ----------
const R = rng(42);
function addUgly(c) {
  const u = { pimples: [], dirt: [], tufts: [] };
  // espinhas no rosto e no focinho
  const pimpleM = M(0xd8434a, 0.35), tipM = M(0xfff3c4, 0.4);
  const spots = [[-0.2, 0.15, 0.28], [0.19, 0.16, 0.29], [-0.24, -0.04, 0.27], [0.25, -0.06, 0.26], [-0.13, -0.17, 0.4],
    [0.14, -0.19, 0.4], [0.05, -0.1, 0.48], [-0.07, 0.2, 0.33], [0.09, 0.22, 0.32], [-0.18, -0.24, 0.33], [0.2, -0.26, 0.31],
    [0, 0.18, 0.37], [-0.27, 0.07, 0.22], [0.28, 0.06, 0.22], [-0.05, -0.29, 0.4]];
  spots.forEach(([x, y, z], i) => {
    const r = 0.022 + R() * 0.016;
    const p = add(c.head, SPH, pimpleM, [x, y, z], [r, r, r * 0.8]);
    if (i % 3 === 0) add(p, SPH, tipM, [0, 0.35, 0.75], [0.45, 0.45, 0.45]);
    u.pimples.push(p);
  });
  // dente torto
  u.tooth = add(c.head, BOX, M(0xf4ecd0, 0.4), [0.04, -0.235, 0.47], [0.04, 0.05, 0.02], [0, 0, 0.3]);
  // pelo arrepiado (tufos)
  const fur = c.body.children[0].material;
  for (let i = 0; i < 26; i++) {
    const onHead = i < 12;
    const parent = onHead ? c.head : c.body;
    const a = R() * Math.PI * 2, b = onHead ? 0.2 + R() * 0.9 : 0.4 + R() * 1.2;
    const rr = onHead ? 0.36 : 0.44;
    const pos = onHead ? [Math.sin(b) * Math.cos(a) * rr, Math.cos(b) * rr + 0.02, -Math.abs(Math.sin(b) * Math.sin(a)) * rr * 0.9 - 0.02]
      : [Math.sin(b) * Math.cos(a) * rr, 0.75 + Math.cos(b) * 0.5, Math.sin(b) * Math.sin(a) * 0.36];
    const t = add(parent, new THREE.ConeGeometry(0.06, 0.22, 6), fur, pos, [1, 1, 1]);
    t.lookAt(t.position.clone().multiplyScalar(3).add(V(0, onHead ? 0 : -1.5, 0)));
    t.rotateX(Math.PI / 2);
    u.tufts.push(t);
  }
  // sujeira
  const dirtM = M(0x5a4426, 1), dirtM2 = M(0x6b5a2c, 1);
  [[0.2, 0.85, 0.3, 0.13], [-0.25, 0.6, 0.29, 0.15], [0.05, 0.45, 0.3, 0.1], [0.32, 1.05, 0.15, 0.1], [-0.3, 0.95, 0.18, 0.09]].forEach(([x, y, z, r], i) =>
    u.dirt.push(add(c.body, SPH, i % 2 ? dirtM : dirtM2, [x, y, z], [r, r * 0.8, r * 0.35])));
  u.dirt.push(add(c.head, SPH, dirtM, [0.17, 0.0, 0.33], [0.07, 0.05, 0.03]));
  u.dirt.push(add(c.head, SPH, dirtM2, [-0.12, -0.3, 0.37], [0.06, 0.04, 0.03]));
  for (const a of c.arms) u.dirt.push(add(a.el, SPH, dirtM, [0, -0.2, 0.08], [0.08, 0.1, 0.05]));
  // casca de banana na cabeça (cena do lixo)
  const peel = new THREE.Group(); peel.position.set(0.05, 0.36, 0); c.head.add(peel);
  const peelM = M(0xf0cd3c, 0.6), peelD = M(0x7a5a1a, 0.7);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); g.rotation.y = i * Math.PI / 2 + 0.3; peel.add(g);
    add(g, SPH, peelM, [0.13, -0.05, 0], [0.1, 0.035, 0.05], [0, 0, -0.6]);
  }
  add(peel, CYL, peelD, [0, 0.05, 0], [0.025, 0.09, 0.025]);
  peel.visible = false; u.peel = peel;
  c.ugly = u;
  return c;
}
function setClean(c, k) {   // k: 0 sujo -> 1 limpo
  const u = c.ugly;
  for (const d of u.dirt) d.visible = k < 0.5;
  for (const t of u.tufts) t.scale.setScalar(lerp(1, 0.35, k));
}
function addPretty(c) {
  const bowM = M(0xff6fa8, 0.45);
  const bow = new THREE.Group(); bow.position.set(0.17, 0.3, 0.05); bow.rotation.z = -0.4; c.head.add(bow);
  for (const s of [-1, 1]) add(bow, new THREE.ConeGeometry(0.1, 0.17, 16), bowM, [s * 0.09, 0, 0], [1, 1, 0.5], [0, 0, s * Math.PI / 2]);
  add(bow, SPH, bowM, [0, 0, 0], [0.05, 0.05, 0.05]);
  const lashM = M(0x111111, 0.5);
  for (const e of c.eyes) for (let i = 0; i < 3; i++) {
    const side = Math.sign(e.position.x);
    add(e, BOX, lashM, [side * (0.02 + i * 0.025), 0.07, 0.03], [0.008, 0.045, 0.008], [0.3, 0, -side * (0.2 + i * 0.35)]);
  }
  const blushM = M(0xff8fa3, 0.6, 0, { transparent: true, opacity: 0.55 });
  for (const s of [-1, 1]) add(c.head, SPH, blushM, [s * 0.19, -0.09, 0.33], [0.06, 0.04, 0.03]);
  c.lowLip.material = M(0xe23d5c, 0.25);
  const goldM = M(0xf2c14e, 0.25, 1);
  for (const s of [-1, 1]) add(c.head, SPH, goldM, [s * 0.38, -0.13, 0.02], [0.035, 0.035, 0.035]);
  return c;
}
const hero = addUgly(makeChimp({ fur: 0x2d2a25 }));
const julia = addPretty(makeChimp({ fur: 0x3b2f2b, shirt: 0xb983ff }));
const chad = makeChimp({ rich: true, fur: 0x26242a });
chad.body.children[0].scale.set(0.6, 0.6, 0.45);
for (const a of chad.arms) a.sh.scale.setScalar(1.25);
chad.head.scale.setScalar(0.92);
hero.seed = 0.1; julia.seed = 0.5; chad.seed = 0.7;
const chars = [hero, julia, chad];
for (const c of chars) scene.add(c.root);

// moscas
const flies = [];
for (let i = 0; i < 4; i++) {
  const f = new THREE.Group();
  add(f, SPH, M(0x111111, 0.3), [0, 0, 0], [0.035, 0.03, 0.045]);
  const wm = new THREE.MeshBasicMaterial({ color: 0xdfefff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), wm), w2 = w1.clone();
  w1.position.set(0.03, 0.02, 0); w2.position.set(-0.03, 0.02, 0);
  f.add(w1, w2); f.userData.w = [w1, w2];
  scene.add(f); flies.push(f);
}
function updateFlies(on, t, center) {
  flies.forEach((f, i) => {
    f.visible = on; if (!on) return;
    const a = t * (2.2 + i * 0.4) + i * 1.7;
    f.position.set(center.x + Math.cos(a) * (0.55 + 0.1 * Math.sin(t * 3 + i)), center.y + 0.15 * Math.sin(a * 1.7 + i) + (i % 2) * 0.2, center.z + Math.sin(a) * 0.45);
    f.rotation.y = -a;
    const fl = Math.sin(t * 90 + i) * 0.8;
    f.userData.w[0].rotation.z = fl; f.userData.w[1].rotation.z = -fl;
  });
}
// cheiro verde
const stink = [];
for (let i = 0; i < 18; i++) {
  const m = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: 0x8ee04a, transparent: true, opacity: 0.35, depthWrite: false }));
  scene.add(m); stink.push(m);
}
function updateStink(amount, t, base) {
  stink.forEach((s, i) => {
    s.visible = amount > 0.01; if (!s.visible) return;
    const ph = ((t * 0.45 + i / stink.length) % 1);
    const a = i * 2.4;
    s.position.set(base.x + Math.cos(a) * (0.35 + ph * 0.25) + Math.sin(t * 2 + i) * 0.1, base.y + 0.3 + ph * 2.0, base.z + Math.sin(a) * 0.3 - 0.1);
    s.position.z -= 0.25;
    s.scale.setScalar(0.07 + ph * 0.16);
    s.material.opacity = 0.3 * Math.sin(ph * Math.PI) * Math.min(1, amount);
  });
}
// bolhas de sabão (espuma)
const N_B = 110;
const bubbleM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.88 });
const bubbles = new THREE.InstancedMesh(SPH, bubbleM, N_B); scene.add(bubbles);
const bR = []; { const r = rng(8); for (let i = 0; i < N_B; i++) bR.push([r(), r(), r(), r()]); }
const dmy = new THREE.Object3D();
function updateBubbles(mode, t, c, k = 1) {
  bubbles.visible = !!mode; if (!mode) return;
  for (let i = 0; i < N_B; i++) {
    const [a, b, cc, d] = bR[i];
    if (mode === 'foam') {   // espuma cobrindo o macaco
      const th = a * Math.PI * 2, ph = b * Math.PI * 0.85;
      const rr = 0.55 + d * 0.2;
      dmy.position.set(c.x + Math.sin(ph) * Math.cos(th) * rr, c.y + 0.75 + Math.cos(ph) * 0.75 + Math.sin(t * 3 + i) * 0.02, c.z + Math.sin(ph) * Math.sin(th) * rr * 0.8);
      dmy.scale.setScalar((0.1 + cc * 0.13) * k);
    } else {                  // bolhas subindo
      const h = (t * (0.3 + cc * 0.4) + d * 3) % 3;
      dmy.position.set(c.x + (a - 0.5) * 2.6 + Math.sin(t + i) * 0.1, c.y + h, c.z + (b - 0.5) * 1.6);
      dmy.scale.setScalar((0.04 + cc * 0.07) * Math.sin(Math.PI * h / 3) * k);
    }
    dmy.updateMatrix(); bubbles.setMatrixAt(i, dmy.matrix);
  }
  bubbles.instanceMatrix.needsUpdate = true;
}
// brilhos
const sparkM = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.9, depthWrite: false });
const sparks = []; for (let i = 0; i < 16; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(1), sparkM); scene.add(s); sparks.push(s); }
function updateSparks(on, t, center, rad = 0.9) {
  sparks.forEach((s, i) => {
    s.visible = on; if (!on) return;
    const ph = (t * 0.8 + i / 16) % 1;
    const a = i * 2.39;
    s.position.set(center.x + Math.cos(a) * rad * (0.6 + ph * 0.4), center.y + Math.sin(a * 1.3) * rad * 0.9, center.z + Math.sin(a) * 0.4 + 0.3);
    s.scale.set(0.035, 0.08, 0.035).multiplyScalar(Math.sin(ph * Math.PI));
    s.rotation.y = t * 3 + i;
  });
}
// corações (Júlia)
const heartTex = textTex((g, W, H) => {
  g.fillStyle = '#ff4d79'; g.beginPath();
  g.moveTo(W / 2, H * 0.85); g.bezierCurveTo(W * 0.05, H * 0.5, W * 0.15, H * 0.05, W / 2, H * 0.3);
  g.bezierCurveTo(W * 0.85, H * 0.05, W * 0.95, H * 0.5, W / 2, H * 0.85); g.fill();
}, 128, 128);
const hearts = []; for (let i = 0; i < 6; i++) { const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false })); scene.add(h); hearts.push(h); }
function updateHearts(on, t, base) {
  hearts.forEach((h, i) => {
    h.visible = on; if (!on) return;
    const ph = (t * 0.5 + i / 6) % 1;
    h.position.set(base.x + Math.sin(i * 2.1 + t) * 0.5, base.y + ph * 1.4, base.z + 0.2);
    const s = 0.22 * Math.sin(ph * Math.PI); h.scale.set(s, s, s);
    h.material.opacity = Math.sin(ph * Math.PI);
  });
}

// =========================================================
//   CENÁRIOS
// =========================================================
const sets = {};
// ---------- PARQUE (encontro) ----------
{
  const g = new THREE.Group(); sets.park = g; scene.add(g);
  add(g, CYL, M(0x86c66a, 1), [0, -0.05, 0], [40, 0.1, 40]);
  add(g, BOX, M(0xe9d8b4, 0.95), [0, 0.0, 1], [40, 0.03, 2.2]);
  // banco
  const wood = M(0xb5713f, 0.7), iron = M(0x3b3f47, 0.5, 0.5);
  for (let i = 0; i < 3; i++) add(g, BOX, wood, [0, 0.55, -0.55 + i * 0.18], [3.2, 0.06, 0.14]);
  for (let i = 0; i < 3; i++) add(g, BOX, wood, [0, 0.85 + i * 0.17, -0.82], [3.2, 0.12, 0.05], [0.12, 0, 0]);
  for (const s of [-1, 1]) { add(g, BOX, iron, [s * 1.45, 0.28, -0.35], [0.08, 0.56, 0.6]); add(g, BOX, iron, [s * 1.45, 0.8, -0.8], [0.08, 0.6, 0.08]); }
  // árvores e flores
  const tree = (x, z, s = 1) => { add(g, CYL, M(0x7a5233, 0.9), [x, 1.0 * s, z], [0.18 * s, 2 * s, 0.18 * s]); add(g, SPH, M(0x5aa54a, 0.85), [x, 2.6 * s, z], [1.2 * s, 1.1 * s, 1.2 * s]); add(g, SPH, M(0x6dbb57, 0.85), [x + 0.5 * s, 2.3 * s, z + 0.4], [0.8 * s, 0.75 * s, 0.8 * s]); };
  tree(-3.2, -3, 1.2); tree(3.6, -4, 1.4); tree(-6, -6, 1.5); tree(7, -7, 1.6); tree(0.5, -9, 1.8);
  const fc = [0xff7aa2, 0xffd166, 0xffffff, 0xc77dff];
  for (let i = 0; i < 40; i++) add(g, SPH, M(fc[i % 4], 0.6), [(R() - 0.5) * 12, 0.08, -1.6 - R() * 4], [0.07, 0.07, 0.07]);
  // poste
  add(g, CYL, iron, [2.4, 1.4, -1.2], [0.05, 2.8, 0.05]);
  add(g, SPH, M(0xfff3c4, 0.3, 0, { emissive: 0xffe08a, emissiveIntensity: 0.6 }), [2.4, 2.9, -1.2], [0.18, 0.18, 0.18]);
}
// ---------- BECO (lata de lixo) ----------
const bricks = textTex((g, W, H) => {
  g.fillStyle = '#5a4a46'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 9; x++) {
    g.fillStyle = ['#8a4f3d', '#7c4636', '#94594a'][(x + y * 3) % 3];
    g.fillRect(x * 60 + (y % 2) * 30 - 30 + 3, y * 32 + 3, 54, 26);
  }
}, 512, 512);
bricks.wrapS = bricks.wrapT = THREE.RepeatWrapping; bricks.repeat.set(3, 1.5);
{
  const g = new THREE.Group(); g.position.set(40, 0, 0); sets.alley = g; scene.add(g);
  add(g, BOX, M(0x4d5157, 0.9), [0, -0.05, 0], [16, 0.1, 16]);
  add(g, BOX, new THREE.MeshStandardMaterial({ map: bricks, roughness: 0.95 }), [0, 3, -2.5], [12, 6, 0.2]);
  const can = new THREE.Group(); can.position.set(0, 0, -0.6); g.add(can); sets.can = can;
  const metal = M(0x8d969e, 0.45, 0.7);
  add(can, CYL, metal, [0, 0.6, 0], [0.62, 1.2, 0.62]);
  for (let i = 0; i < 3; i++) add(can, CYL, M(0x737b83, 0.4, 0.7), [0, 0.25 + i * 0.35, 0], [0.64, 0.04, 0.64]);
  const lid = new THREE.Group(); lid.position.set(0, 1.22, 0); can.add(lid); sets.lid = lid;
  add(lid, CYL, metal, [0, 0, 0], [0.68, 0.06, 0.68]);
  add(lid, CYL, metal, [0, 0.06, 0], [0.15, 0.06, 0.08], [0, 0, Math.PI / 2]);
  // sacos de lixo e restos
  const bag = M(0x1d1f22, 0.25, 0.1);
  add(g, SPH, bag, [-1.2, 0.4, -1.2], [0.55, 0.45, 0.5]); add(g, SPH, bag, [-1.9, 0.35, -1.6], [0.45, 0.38, 0.45]);
  add(g, SPH, bag, [1.3, 0.35, -1.4], [0.5, 0.38, 0.45]);
  add(g, CYL, M(0x3c7ab0, 0.2, 0, { transparent: true, opacity: 0.55 }), [1.0, 0.01, 0.6], [0.8, 0.01, 0.5]);
  for (let i = 0; i < 5; i++) add(g, BOX, M([0xc0392b, 0xf1c40f, 0xecf0f1][i % 3], 0.8), [(R() - 0.5) * 3, 0.03, R() * 1.2], [0.2, 0.04, 0.12], [0, R() * 3, 0]);
}
// ---------- BANHEIRO ----------
const tiles = textTex((g, W, H) => {
  g.fillStyle = '#d9f0f2'; g.fillRect(0, 0, W, H); g.strokeStyle = '#a9d3d8'; g.lineWidth = 4;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, H); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(W, i * 64); g.stroke(); }
}, 512, 512);
tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(3, 2);
{
  const g = new THREE.Group(); g.position.set(-40, 0, 0); sets.bath = g; scene.add(g);
  add(g, BOX, M(0xf3f0ea, 0.6), [0, -0.05, 0], [14, 0.1, 14]);
  add(g, BOX, new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.4 }), [0, 3, -2.2], [12, 6, 0.2]);
  // banheira
  const white = M(0xffffff, 0.25);
  add(g, BOX, white, [0, 0.4, -1.0], [2.6, 0.8, 1.3]);
  for (const s of [-1, 1]) add(g, CYL, white, [s * 1.3, 0.4, -1.0], [0.65, 0.8, 0.65]);
  for (const s of [-1, 1]) add(g, SPH, M(0xd4a017, 0.3, 1), [s * 1.0, 0.04, -0.45], [0.1, 0.08, 0.1]);
  const water = add(g, BOX, M(0x7fd3ef, 0.1, 0, { transparent: true, opacity: 0.85 }), [0, 0.76, -1.0], [2.5, 0.04, 1.15]);
  sets.water = water;
  // chuveiro e patinho
  const chrome = M(0xdfe6ea, 0.15, 1);
  add(g, CYL, chrome, [1.25, 2.0, -2.05], [0.04, 2.4, 0.04]);
  add(g, CYL, chrome, [1.25, 3.2, -1.85], [0.04, 0.4, 0.04], [Math.PI / 2, 0, 0]);
  add(g, CYL, chrome, [1.25, 3.15, -1.62], [0.18, 0.06, 0.18]);
  const duck = new THREE.Group(); duck.position.set(-0.7, 0.82, -0.7); g.add(duck); sets.duck = duck;
  add(duck, SPH, M(0xffd23f, 0.4), [0, 0, 0], [0.16, 0.12, 0.2]);
  add(duck, SPH, M(0xffd23f, 0.4), [0, 0.15, 0.08], [0.1, 0.1, 0.1]);
  add(duck, new THREE.ConeGeometry(0.04, 0.09, 12), M(0xff8c1a, 0.4), [0, 0.14, 0.2], [1, 1, 1], [Math.PI / 2, 0, 0]);
  // toalha e espelho
  add(g, BOX, M(0xff9fb2, 0.95), [-2.3, 1.4, -2.05], [0.8, 1.1, 0.06]);
  add(g, BOX, chrome, [-2.3, 1.98, -2.05], [1.0, 0.05, 0.1]);
  add(g, BOX, M(0x9fc9d6, 0.05, 1), [2.6, 2.2, -2.08], [1.0, 1.3, 0.04]);
  // tapete
  add(g, BOX, M(0x7bc8a4, 1), [0, 0.01, 0.5], [1.6, 0.02, 0.8]);
}
// ---------- ESTÚDIO (sonho / comparação / escolha) ----------
{
  const g = new THREE.Group(); g.position.set(0, 0, 40); sets.studio = g; scene.add(g);
  add(g, CYL, M(0xf6efe6, 0.6), [0, -0.05, 0], [7, 0.1, 7]);
  add(g, CYL, M(0xffffff, 0.4), [0, 0.06, 0], [1.1, 0.12, 1.1]);
  // pedestal A: skincare
  const A = new THREE.Group(); A.position.set(-1.2, 0, -1.7); g.add(A); sets.podA = A;
  add(A, CYL, M(0xffb3c7, 0.5), [0, 0.45, 0], [0.75, 0.9, 0.75]);
  add(A, CYL, M(0xffffff, 0.3), [-0.3, 1.15, 0], [0.12, 0.5, 0.12]);
  add(A, CYL, M(0xff7aa2, 0.3), [-0.3, 1.45, 0], [0.05, 0.1, 0.05]);
  add(A, CYL, M(0xc7f0e0, 0.3), [0.05, 1.05, 0.15], [0.22, 0.3, 0.22]);
  add(A, CYL, M(0xffffff, 0.3), [0.05, 1.22, 0.15], [0.23, 0.05, 0.23]);
  add(A, BOX, M(0xb2e3f5, 0.3), [0.35, 1.15, -0.1], [0.14, 0.5, 0.1]);
  for (let i = 0; i < 3; i++) add(A, CYL, M(0x9bd770, 0.6), [-0.1 + i * 0.22, 0.93, 0.45], [0.1, 0.03, 0.1]);
  // pedestal B: barbearia
  const B = new THREE.Group(); B.position.set(1.2, 0, -1.7); g.add(B); sets.podB = B;
  add(B, CYL, M(0x9cc9ff, 0.5), [0, 0.45, 0], [0.75, 0.9, 0.75]);
  const pole = textTex((c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); for (let i = -4; i < 12; i++) { c.fillStyle = i % 2 ? '#e63946' : '#1d4ed8'; c.beginPath(); c.moveTo(0, i * 40); c.lineTo(W, i * 40 + 60); c.lineTo(W, i * 40 + 80); c.lineTo(0, i * 40 + 20); c.fill(); } }, 128, 256);
  const poleMesh = add(B, CYL, new THREE.MeshStandardMaterial({ map: pole, roughness: 0.3 }), [0.35, 1.35, -0.1], [0.11, 0.9, 0.11]);
  sets.pole = poleMesh;
  add(B, SPH, M(0xdfe6ea, 0.15, 1), [0.35, 1.82, -0.1], [0.12, 0.12, 0.12]);
  const sc = new THREE.Group(); sc.position.set(-0.2, 1.15, 0.15); sc.rotation.set(0, 0, 0.5); B.add(sc); sets.scissors = sc;
  const steel = M(0xd9dee3, 0.15, 1);
  for (const s of [-1, 1]) {
    const blade = new THREE.Group(); blade.rotation.z = s * 0.25; sc.add(blade); blade.userData.s = s;
    add(blade, BOX, steel, [0, 0.22, 0], [0.04, 0.42, 0.015]);
    add(blade, new THREE.TorusGeometry(0.08, 0.025, 8, 20), M(0x1d4ed8, 0.4), [s * 0.06, -0.08, 0]);
  }
  add(B, BOX, M(0x222222, 0.4), [-0.25, 0.93, 0.4], [0.45, 0.03, 0.08]);
}

// =========================================================
//   OVERLAYS
// =========================================================
const $ = id => document.getElementById(id);
const el = { cap: $('caption'), hud: $('hud'), day: $('day'), left: $('left'), bar: $('bar'), pct: $('pct'), mark: $('mark'),
  flash: $('flash'), tag: $('tag'), cards: $('cards'), cA: $('cardA'), cB: $('cardB'), cta: $('cta'), ep: $('ep'), tint: $('tint') };
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
let glow = 0;   // % do glow up
function hud(t, vis, o = {}) {
  show(el.hud, vis, `translateY(${(1 - vis) * -40}px)`);
  el.day.textContent = 'DIA 1 / 30';
  el.left.textContent = `faltam ${o.left ?? 30} dias`;
  el.left.style.transform = o.pulse ? `scale(${1 + 0.08 * Math.abs(Math.sin(t * 6))})` : '';
  el.left.style.color = o.pulse ? '#ff5a6e' : '';
  el.bar.style.width = `${glow}%`;
  el.pct.textContent = `${Math.round(glow)}%`;
  show(el.mark, o.mark ?? 0);
}
function flashAt(t, times, d = 0.2) {
  let f = 0; for (const x of times) if (t >= x && t < x + d) f = Math.max(f, 1 - (t - x) / d);
  el.flash.style.opacity = f * 0.8;
}
function tag(text, k, color = '#ff5a6e', y = 0) {
  el.tag.textContent = text; el.tag.style.background = color;
  const s = back(k); show(el.tag, clamp(k * 3), `translateY(${y}px) rotate(-3deg) scale(${s})`);
}

// =========================================================
//   LUZ / CÂMERA
// =========================================================
function lights(p) {
  gold.intensity = 0; fill.intensity = 0.6; rim.color.set(0xa9cfff); spot.intensity = 0; lamp.intensity = 0;
  scene.fog = null; renderer.toneMappingExposure = 1.05;
  if (p === 'park') {
    scene.background = new THREE.Color(0x9ad8f5); scene.fog = new THREE.Fog(0xbfe6f7, 14, 40);
    hemi.color.set(0xd8efff); hemi.groundColor.set(0x6a8a4a); hemi.intensity = 1.0; sun.color.set(0xffefd0); sun.intensity = 2.4; rim.intensity = 1.0;
  } else if (p === 'alley') {
    scene.background = new THREE.Color(0x2a3328); scene.fog = new THREE.Fog(0x55703f, 4, 16);
    hemi.color.set(0xb8d8a0); hemi.groundColor.set(0x30302a); hemi.intensity = 0.7; sun.color.set(0xd9f0b0); sun.intensity = 1.4; rim.intensity = 1.5; rim.color.set(0x9cff7a);
  } else if (p === 'bath') {
    scene.background = new THREE.Color(0xd9f0f2);
    hemi.color.set(0xffffff); hemi.groundColor.set(0xbfd9dc); hemi.intensity = 1.1; sun.color.set(0xffffff); sun.intensity = 1.9; rim.intensity = 0.9;
  } else if (p === 'dream') {
    scene.background = new THREE.Color(0xffd77a);
    hemi.color.set(0xfff2c8); hemi.groundColor.set(0xa8743a); hemi.intensity = 1.0; sun.color.set(0xffe6a8); sun.intensity = 2.0; rim.intensity = 2.2; rim.color.set(0xffc94a); gold.intensity = 30;
  } else if (p === 'studio') {
    scene.background = new THREE.Color(0xc9b6ff);
    hemi.color.set(0xffffff); hemi.groundColor.set(0x9a88c8); hemi.intensity = 1.1; sun.color.set(0xfff5ea); sun.intensity = 2.0; rim.intensity = 1.4; rim.color.set(0xffb8e0);
  }
}
function sunAt(target, off = V(5, 10, 7)) {
  sun.target.position.copy(target); sun.position.copy(target).add(off);
  rim.target.position.copy(target); rim.position.copy(target).add(V(-5, 4, -6));
}
function cam(pos, look, fov = 40, shake = 0, t = 0) {
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.copy(pos);
  if (shake) camera.position.add(V(Math.sin(t * 61) * shake, Math.sin(t * 47 + 1) * shake, 0));
  camera.lookAt(look);
  fill.position.copy(camera.position).add(V(1.5, 2.5, 0)); fill.target.position.copy(look);
}
const headPos = c => { c.root.updateMatrixWorld(true); return c.head.getWorldPosition(V(0, 0, 0)); };
const rootPos = c => c.root.position.clone();
// estado visual do protagonista
function heroLook(t, clean) {
  setClean(hero, clean);
  hero.ugly.peel.visible = false;
  hero.acc.glasses && (hero.acc.glasses.visible = false);
}
function heroFx(t, dirty, center) {
  updateStink(dirty, t, center);
  updateFlies(dirty > 0.5, t, headPos(hero).add(V(0, 0.15, 0)));
}

// =========================================================
//   CENAS
// =========================================================
function hideAll() {
  for (const k of ['park', 'alley', 'bath', 'studio']) sets[k].visible = false;
  for (const c of chars) { c.root.visible = false; c.phone.visible = false; c.root.position.set(0, 0, 0); c.root.rotation.set(0, 0, 0); c.root.scale.setScalar(1); }
  updateStink(0); updateFlies(false); updateBubbles(null); updateSparks(false); updateHearts(false);
  sets.podA.visible = sets.podB.visible = true;
}
const UGLY_LID = 0.38;

// 1) encontro no parque
function shotPark(t) {
  sets.park.visible = true; lights('park'); sunAt(V(0, 0, 0));
  const s = S.g1, mid = s.start + (s.end - s.start) * 0.45;
  julia.root.visible = true; julia.root.position.set(-0.75, 0.5, -0.35); julia.root.rotation.y = 0.35;
  pose(julia, { t, eye: 1.12, open: 0.15, legs: [-1.4, -1.4], arms: [[[-0.3, 0, 0.3], -0.9], [[0.1, 0, -0.2], -0.2]], head: [0, 0.25 + 0.05 * Math.sin(t * 2), 0.12] });
  hero.root.visible = true; heroLook(t, 0);
  hero.root.position.set(1.1, 0, 0.6); hero.root.rotation.y = -0.2;
  pose(hero, { t, lid: UGLY_LID, eye: 0.95, open: 0.45, arms: [[[0.1, 0, 0.2], -0.3], [[-2.5 + Math.sin(t * 8) * 0.25, 0, -0.9], -0.5]], head: [0.05, -0.1, -0.12 + Math.sin(t * 3) * 0.05] });
  heroFx(t, 1, rootPos(hero));
  updateHearts(t < mid + 0.3, t, headPos(julia).add(V(0, 0.4, 0)));
  // câmera: começa na Júlia e revela o macaco
  const k = sm(P(t, mid - 0.4, mid + 0.6));
  const hj = headPos(julia), hh = headPos(hero);
  const look = hj.clone().lerp(hh, k).add(V(0, -0.25, 0));
  cam(V(look.x + lerp(0.2, 0.1, k), 1.6, lerp(4.0, 4.3, k)), look, 40, P(t, mid, mid + 0.3) > 0 && t < mid + 0.3 ? 0.03 : 0, t);
  tag('PROBLEMA', P(t, s.end - 0.6, s.end - 0.3), '#ff5a6e', 0);
}
// 2) close nas espinhas
function shotUgly(t) {
  sets.park.visible = true; lights('park'); sunAt(V(0, 0, 0));
  const s = S.g2;
  hero.root.visible = true; heroLook(t, 0);
  hero.root.position.set(0, 0, 0);
  pose(hero, { t, lid: UGLY_LID, talk: 0, open: 0.35, look: [Math.sin(t * 1.5) * 0.2, 0], arms: [[[-1.6, 0, 0.2], -1.6], [[0.1, 0, -0.2], -0.3]], head: [0.08, 0.15, 0.05] });
  heroFx(t, 1, rootPos(hero));
  const hp = headPos(hero);
  const k = sm(P(t, s.start - 0.3, S.g3.start));
  cam(V(hp.x + 0.35, hp.y + 0.12, hp.z + lerp(2.6, 1.9, k)), V(hp.x, hp.y - 0.12, hp.z), 40);
  tag('URGENTE', P(t, s.end - 1.2, s.end - 0.9), '#ff5a6e', 30);
}
// 3) visão do CHAD + HUD aparece
function shotChad(t) {
  sets.studio.visible = true; sets.podA.visible = sets.podB.visible = false; lights('dream');
  const base = V(0, 0, 40); sunAt(base);
  const s = S.g3;
  hero.root.visible = true; heroLook(t, 0);
  hero.root.position.set(-0.75, 0, 41.2); hero.root.rotation.y = 0.3;
  pose(hero, { t, lid: UGLY_LID, eye: 1.2, open: 0.6, arms: [[[-0.5, 0, 0.4], -1.0], [[-0.5, 0, -0.4], -1.0]], head: [-0.25, -0.4, 0] });
  heroFx(t, 1, rootPos(hero));
  const ck = back(P(t, s.start + 0.6, s.start + 1.3));
  chad.root.visible = ck > 0.01; chad.root.position.set(0.45, 0.12, 39.8); chad.root.scale.setScalar(1.25 * ck);
  pose(chad, { t, eye: 1, open: 0.05, arms: [[[0.2, 0, 0.6], -1.9], [[0.2, 0, -0.6], -1.9]], head: [-0.05, 0, 0] });
  gold.position.copy(headPos(chad)).add(V(0, 0.5, 1));
  updateSparks(true, t, headPos(chad).add(V(0, -0.5, 0)), 1.4);
  const k = sm(P(t, s.start - 0.2, S.g4.start));
  cam(V(lerp(0.2, -0.1, k), lerp(1.6, 1.9, k), lerp(46, 45, k)), V(0, lerp(1.6, 1.9, k), 40), 40);
}
// 4) banho começa
function shotBath(t) {
  sets.bath.visible = true; lights('bath');
  const base = V(-40, 0, -1.0); sunAt(base, V(3, 8, 6));
  const s = S.g4, jump = s.start + 1.0;
  const g5end = S.g5.start;
  hero.root.visible = true; heroLook(t, 0);
  const k = P(t, jump, jump + 0.6);
  const x = lerp(-41.15, -40, eo(k)), y = (k > 0 ? lerp(0, 0.2, k) + Math.sin(k * Math.PI) * 1.0 : 0);
  hero.root.position.set(x, y, lerp(0.35, -1.0, eo(k)));
  pose(hero, { t, lid: UGLY_LID, eye: 1 + 0.3 * pulse(t, jump, 0.6), open: 0.4 + 0.5 * pulse(t, jump, 0.6), arms: k > 0 ? [[[-2.8, 0, 0.3], -0.2], [[-2.8, 0, -0.3], -0.2]] : [[[-0.3, 0, 0.3], -0.6], [[-0.3, 0, -0.3], -0.6]], legs: k > 0 && k < 1 ? [-1.2, -1.2] : null, head: [0, 0.3 * (1 - k), 0] });
  heroFx(t, 1, rootPos(hero));
  if (k > 0.9) updateBubbles('rise', t, V(-40, 0.8, -1.0), sm(P(t, jump + 0.5, jump + 0.9)));
  const c = sm(P(t, s.start - 0.2, g5end));
  cam(V(-40.4 + lerp(-0.3, 0.2, c), lerp(1.7, 1.9, c), lerp(5.6, 5.0, c)), V(-40.5, 1.2, -0.6), 44, pulse(t, jump + 0.55, 0.3) * 0.04, t);
}
// 5) flashback: lata de lixo
function shotTrash(t) {
  sets.alley.visible = true; lights('alley');
  const base = V(40, 0, -0.6); sunAt(base, V(3, 8, 5));
  const s = S.g5, pop = s.start + 0.5;
  hero.root.visible = true; heroLook(t, 0); hero.ugly.peel.visible = true;
  const k = back(P(t, pop, pop + 0.45));
  hero.root.position.set(40, lerp(-0.4, 0.55, k), -0.6);
  sets.lid.position.set(lerp(0, -0.6, k), 1.22 + Math.sin(clamp(k) * Math.PI) * 0.9 + k * 0.4, lerp(0, 0.2, k));
  sets.lid.rotation.set(lerp(0, -1.2, clamp(k)), 0, lerp(0, 0.6, clamp(k)));
  pose(hero, { t, lid: UGLY_LID, open: 0.5, arms: [[[-2.4, 0, 0.8], -0.4], [[-0.6 + Math.sin(t * 4) * 0.2, 0, -0.9], -1.3]], head: [0, 0, Math.sin(t * 2) * 0.12] });
  heroFx(t, 1.4, rootPos(hero).add(V(0, 0.4, 0)));
  const c = sm(P(t, s.start, s.end));
  cam(V(40 + lerp(-0.8, 0.4, c), lerp(1.8, 2.3, c), lerp(4.6, 3.4, c)), V(40, 1.7, -0.6), 42);
  el.tint.style.opacity = 0.35;
  tag('6 MESES ATRÁS', P(t, s.start + 0.1, s.start + 0.4), '#556b2f', 0);
}
// 5b/6) espuma -> revelação limpa
function shotScrub(t) {
  sets.bath.visible = true; lights('bath');
  const base = V(-40, 0, -1.0); sunAt(base, V(3, 8, 6));
  const reveal = S.g6.start + 0.25;
  const cleanK = t > reveal ? 1 : 0;
  hero.root.visible = true; heroLook(t, cleanK);
  const stand = sm(P(t, reveal, reveal + 0.4));
  hero.root.position.set(-40, lerp(0.15, 0.62, stand), -1.0);
  hero.root.rotation.z = cleanK ? 0 : Math.sin(t * 9) * 0.05;
  pose(hero, { t, lid: cleanK ? 0.1 : UGLY_LID, eye: cleanK ? 1.08 : 1, open: cleanK ? 0.25 : 0.3,
    arms: cleanK ? [[[-2.6, 0, 0.5], -0.3], [[0.1, 0, -0.2], -0.3]] : [[[-2.3 + Math.sin(t * 12) * 0.4, 0, 0.6], -1.2], [[-2.3 - Math.sin(t * 12) * 0.4, 0, -0.6], -1.2]],
    head: [0, cleanK ? 0.1 : 0, cleanK ? 0.12 : 0] });
  if (!cleanK) { updateBubbles('foam', t, rootPos(hero), 1); heroFx(t, 0.4, rootPos(hero)); }
  else { updateBubbles('rise', t, V(-40, 0.8, -1.0), 1 - sm(P(t, reveal, reveal + 1.5))); updateSparks(true, t, headPos(hero), 0.8); }
  const hp = headPos(hero);
  const z = eo(P(t, reveal, reveal + 0.4));
  cam(V(hp.x + 0.25, hp.y + lerp(0.6, 0.2, z), hp.z + lerp(3.6, 2.9, z)), V(hp.x, hp.y - lerp(0.6, 0.45, z), hp.z), 42);
  flashAt(t, [reveal - 0.05], 0.3);
  glow = 12 * eo(P(t, reveal + 0.5, reveal + 1.3));
  tag('LIMPINHO!', P(t, reveal + 0.3, reveal + 0.6) * (t < S.g6.end ? 1 : 0), '#2bb673', 0);
}
// 7) comparação com a Júlia
function shotCompare(t) {
  sets.studio.visible = true; sets.podA.visible = sets.podB.visible = false; lights('studio');
  const base = V(0, 0, 40); sunAt(base);
  const s = S.g7;
  julia.root.visible = true; julia.root.position.set(-0.85, 0, 40); julia.root.rotation.y = 0.25;
  pose(julia, { t, eye: 1.12, open: 0.15, arms: [[[0.1, 0, 0.2], -0.3], [[-2.4, 0, -0.5], -1.7]], head: [0, 0.15, 0.15 + 0.04 * Math.sin(t * 2)] });
  updateSparks(true, t, headPos(julia).add(V(0, -0.3, 0)), 0.9);
  hero.root.visible = true; heroLook(t, 1);
  hero.root.position.set(0.85, 0, 40); hero.root.rotation.y = -0.25;
  pose(hero, { t, lid: 0.1, eye: 1.05, look: [-0.4, 0], open: 0.2, arms: [[[0.1, 0, 0.15], -0.2], [[-0.6, 0, -0.9], -1.9]], head: [0.05, -0.3, -0.08] });
  const k = sm(P(t, s.start - 0.2, S.g8.start));
  cam(V(0, 1.9, lerp(46.2, 45.4, k)), V(0, 1.45, 40), 40);
}
// 8-12) a escolha
function shotChoice(t) {
  sets.studio.visible = true; lights('studio');
  const base = V(0, 0, 40); sunAt(base);
  hero.root.visible = true; heroLook(t, 1);
  hero.root.position.set(0, 0.12, 40.2);
  const tA = S.g10.start, tB = S.g10.start + (S.g10.end - S.g10.start) * 0.45;
  const lookDir = t < tA ? Math.sin(t * 2.5) * 0.4 : t < tB ? -1 : t < S.g10.end ? 1 : 0;
  const thinking = t < tA;
  const pointCam = t > S.g11.start;
  pose(hero, { t, lid: 0.1, eye: 1.05, look: [lookDir * 0.45, 0], open: 0.2, talk: 0,
    arms: pointCam ? [[[-1.5, 0, 0.1], -0.1], [[0.1, 0, -0.2], -0.3]] : thinking ? [[[0.1, 0, 0.15], -0.2], [[-0.6, 0, -0.9], -1.9]]
      : lookDir < 0 ? [[[0.1, 0, 0.15], -0.2], [[-1.4, 0, -0.9], -0.2]] : [[[-1.4, 0, 0.9], -0.2], [[0.1, 0, -0.2], -0.3]],
    head: [0.05, lookDir * 0.45, thinking ? -0.15 : 0] });
  sets.scissors.children.forEach(b => b.rotation.z = b.userData.s * (0.08 + 0.25 * Math.abs(Math.sin(t * 6))));
  sets.pole.rotation.y = t * 2;
  const hiA = t >= tA && t < tB, hiB = t >= tB && t < S.g10.end;
  sets.podA.scale.setScalar(1 + (hiA ? 0.08 : 0)); sets.podB.scale.setScalar(1 + (hiB ? 0.08 : 0));
  if (hiA) updateSparks(true, t, V(-1.2, 1.4, 38.5), 0.7);
  if (hiB) updateSparks(true, t, V(1.2, 1.4, 38.5), 0.7);
  const s = S.g8.start;
  const k = sm(P(t, s - 0.2, s + 2.2));
  const end = sm(P(t, S.g11.start, S.g11.start + 1.2));
  const hp = headPos(hero);
  cam(V(0, lerp(2.3, 2.0, k), lerp(47.5, 46.6, k) - end * 2.2), V(0, lerp(1.3, 1.2, k) + end * (hp.y - 1.3), 40), 44);
  // cartões A / B
  const cin = back(P(t, S.g9.start, S.g9.start + 0.4));
  show(el.cards, clamp(cin * 2) * (1 - sm(P(t, S.g12.start + 0.4, S.g12.start + 0.8))), `scale(${cin})`);
  el.cA.className = 'card' + (hiA ? ' hi' : '') + (t >= S.g10.end ? ' vote' : '');
  el.cB.className = 'card' + (hiB ? ' hi' : '') + (t >= S.g10.end ? ' vote' : '');
  const ck = back(P(t, S.g11.start + 0.1, S.g11.start + 0.5));
  show(el.cta, clamp(ck * 2), `scale(${ck})`);
  const ek = back(P(t, S.g12.end + 0.2, S.g12.end + 0.6));
  show(el.ep, clamp(ek * 2), `scale(${ek})`);
}

// =========================================================
function renderAt(t) {
  hideAll();
  el.flash.style.opacity = 0; el.tint.style.opacity = 0;
  for (const k of ['tag', 'cards', 'cta', 'ep']) show(el[k], 0);
  glow = 0;
  const g = S;
  if (t < g.g2.start - 0.1) shotPark(t);
  else if (t < g.g3.start - 0.1) shotUgly(t);
  else if (t < g.g4.start - 0.1) shotChad(t);
  else if (t < g.g5.start - 0.1) shotBath(t);
  else if (t < g.g5.end + 0.2) shotTrash(t);
  else if (t < g.g7.start - 0.1) shotScrub(t);
  else if (t < g.g8.start - 0.1) shotCompare(t);
  else shotChoice(t);
  if (t >= g.g6.start + 0.75) glow = Math.max(glow, 12 * eo(P(t, g.g6.start + 0.75, g.g6.start + 1.55)));
  // HUD: aparece em "temos 30 dias"
  const hv = sm(P(t, g.g3.start + 0.2, g.g3.start + 0.7));
  hud(t, hv, { mark: t >= g.g7.start && t < g.g8.start - 0.1 ? 1 : 0, pulse: t >= g.g12.start || (t >= g.g3.start + 0.2 && t < g.g3.start + 1.6) });
  flashAt(t, [g.g2.start - 0.1, g.g3.start - 0.1, g.g4.start - 0.1, g.g5.start - 0.1, g.g5.end + 0.2, g.g7.start - 0.1, g.g8.start - 0.1].map(x => x), 0.15);
  if (t >= g.g6.start + 0.2 && t < g.g6.start + 0.5) el.flash.style.opacity = 0.8 * (1 - (t - g.g6.start - 0.2) / 0.3);
  updateCaption(t);
  renderer.render(scene, camera);
}
window.renderAt = renderAt;
window.DURATION = DUR;
window.ready = true;
const q = new URLSearchParams(location.search);
if (q.has('t')) renderAt(parseFloat(q.get('t')));
