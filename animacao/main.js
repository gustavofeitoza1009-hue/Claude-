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

// ---------- personagens ----------
const hero = makeChimp({});                       // versão normal (quarto)
const rich = makeChimp({ rich: true });            // versão milionária
const cousin = makeChimp({ shirt: 0xe58a3a, cap: 0x2b6cb0, fur: 0x2a2523 });
const friend = makeChimp({ shirt: 0x2c3e66, tie: 0xc0392b, briefcase: true, fur: 0x24211f });
const mom = makeChimp({ shirt: 0xd9779b, curlers: true, pearls: true, fur: 0x26222a });
hero.seed = 0; rich.seed = 0.3; cousin.seed = 0.6; friend.seed = 0.15; mom.seed = 0.8;
const crowd = [];
const crowdCols = [0x4f9d69, 0xe9c46a, 0x8e6bbf, 0x3a86c8, 0xd1495b, 0xf4a261, 0x2a9d8f, 0x9c6644];
for (let i = 0; i < 8; i++) { const c = makeChimp({ shirt: crowdCols[i], cap: i % 3 === 0 ? crowdCols[(i + 3) % 8] : null }); c.seed = i * 0.13; crowd.push(c); }
const allChars = [hero, rich, cousin, friend, mom, ...crowd];
for (const c of allChars) scene.add(c.root);

// placas
const friendSign = new THREE.Group();
add(friendSign, CYL, M(0x8b5a2b, 0.7), [0, -0.5, 0], [0.025, 1.0, 0.025]);
const fsPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshStandardMaterial({ map: signTex(['PROPOSTA DE', 'SOCIEDADE'], { fg: '#1f4e79' }), roughness: 0.8, side: THREE.DoubleSide }));
fsPlane.position.y = 0.25; friendSign.add(fsPlane);
const signProp = fsPlane.material.map, signDebt = signTex(['CADÊ MEUS', 'R$ 20?'], { fg: '#b3001b' });
friendSign.position.set(0, -0.1, 0.05); friend.arms[0].hand.add(friendSign);

const debtTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex(['ME DEVE R$ 20'], { bg: '#ffe066', fg: '#b3001b', border: '#b3001b', w: 512, h: 140, sizes: [78] }), depthTest: false }));
debtTag.scale.set(1.25, 0.34, 1); scene.add(debtTag);

const bill = new THREE.Group();
const billPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75), new THREE.MeshStandardMaterial({
  map: textTex((g, W, H) => {
    g.fillStyle = '#fffdf5'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f2b705'; g.fillRect(0, 0, W, 120);
    g.fillStyle = '#222'; g.textAlign = 'center';
    g.font = '900 64px Inter'; g.fillText('CONTA DE LUZ', W / 2, 82);
    g.font = '700 34px Inter'; g.fillStyle = '#555';
    for (let i = 0; i < 6; i++) g.fillRect(50, 170 + i * 46, W - 100 - (i % 3) * 60, 16);
    g.fillStyle = '#c0392b'; g.font = '900 96px Inter'; g.fillText('R$ 487,90', W / 2, 560);
    g.fillStyle = '#222'; g.font = '800 44px Inter'; g.fillText('VENCE HOJE!', W / 2, 640);
  }, 512, 700), roughness: 0.9, side: THREE.DoubleSide
}));
billPlane.position.set(0, 0.25, 0); bill.add(billPlane);
bill.position.set(0.05, -0.05, 0.12); mom.arms[0].hand.add(bill);

// =========================================================
//   CENÁRIOS
// =========================================================
const sets = {};
// ---------- QUARTO ----------
{
  const g = new THREE.Group(); sets.bedroom = g; scene.add(g);
  add(g, BOX, M(0xb07b52, 0.75), [0, -0.05, 0], [14, 0.1, 14]);
  // tábuas
  for (let i = -6; i <= 6; i++) add(g, BOX, M(0x9a6843, 0.8), [i, 0.002, 0], [0.02, 0.01, 14]);
  const wallM = M(0x8fb2d6, 0.95), wallM2 = M(0x9fc0e0, 0.95);
  // parede de fundo com abertura da janela (x 1.0..2.2, y 1.5..2.9)
  add(g, BOX, wallM, [-2.6, 2.5, -3], [7.2, 5, 0.2]);
  add(g, BOX, wallM, [4.6, 2.5, -3], [4.8, 5, 0.2]);
  add(g, BOX, wallM, [1.6, 0.75, -3], [2.2, 1.5, 0.2]);
  add(g, BOX, wallM, [1.6, 3.95, -3], [2.2, 2.1, 0.2]);
  add(g, BOX, wallM2, [-3.6, 2.5, 0], [0.2, 5, 12]);
  // moldura da janela
  const frameM = M(0xf5f5f0, 0.6);
  add(g, BOX, frameM, [1.6, 1.5, -2.88], [1.35, 0.08, 0.12]);
  add(g, BOX, frameM, [1.6, 2.9, -2.88], [1.35, 0.08, 0.12]);
  add(g, BOX, frameM, [0.98, 2.2, -2.88], [0.08, 1.45, 0.12]);
  add(g, BOX, frameM, [2.22, 2.2, -2.88], [0.08, 1.45, 0.12]);
  add(g, BOX, frameM, [1.6, 2.2, -2.88], [0.05, 1.4, 0.06]);
  // céu atrás da janela
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x223061 });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), skyMat); sky.position.set(1.6, 2.5, -7); g.add(sky);
  g.userData.skyMat = skyMat;
  const outsideGround = add(g, BOX, M(0x6fae55, 1), [1.6, 0.0, -6], [10, 0.1, 6]);
  outsideGround.castShadow = false;
  // arbusto lá fora
  add(g, SPH, M(0x4e8f3e, 0.9), [0.6, 0.6, -6], [1.0, 0.9, 0.8]);
  add(g, SPH, M(0x5aa047, 0.9), [2.9, 0.7, -6.3], [1.2, 1.1, 0.8]);
  // cama
  add(g, BOX, M(0x7a4a2c, 0.7), [0, 0.22, -1.2], [2.3, 0.44, 3.4]);
  add(g, BOX, M(0x7a4a2c, 0.7), [0, 0.9, -2.85], [2.4, 1.8, 0.16]);
  add(g, BOX, M(0xfaf7f0, 0.9), [0, 0.56, -1.2], [2.15, 0.26, 3.25]);
  add(g, SPH, M(0xffffff, 0.95), [0, 0.8, -2.35], [0.75, 0.17, 0.32]);
  const blanket = add(g, BOX, M(0xe0735a, 0.95), [0, 0.74, -0.2], [2.25, 0.14, 2.0]);
  add(g, BOX, M(0xf1c453, 0.95), [0, 0.745, -0.6], [2.27, 0.145, 0.18]);
  g.userData.blanket = blanket;
  // criado-mudo + abajur
  add(g, BOX, M(0x8a5a35, 0.7), [1.7, 0.4, -2.2], [0.8, 0.8, 0.7]);
  add(g, CYL, M(0x444a55, 0.5), [1.7, 1.0, -2.2], [0.05, 0.4, 0.05]);
  const shadeM = M(0xffe2b0, 0.9, 0, { emissive: 0xffb15e, emissiveIntensity: 0.6 });
  add(g, new THREE.ConeGeometry(0.3, 0.35, 24, 1, true), shadeM, [1.7, 1.3, -2.2]);
  // despertador
  add(g, CYL, M(0xd64545, 0.4), [1.55, 0.92, -2.05], [0.14, 0.12, 0.14], [Math.PI / 2, 0, 0]);
  add(g, CYL, M(0xffffff, 0.6), [1.55, 0.92, -1.98], [0.11, 0.01, 0.11], [Math.PI / 2, 0, 0]);
  // tapete
  add(g, CYL, M(0x6e9a6c, 1), [-1.5, 0.01, 1.2], [1.3, 0.02, 1.3]);
  // quadro de banana
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshStandardMaterial({
    map: textTex((c, W, H) => {
      c.fillStyle = '#f7e7c6'; c.fillRect(0, 0, W, H); c.lineWidth = 22; c.strokeStyle = '#6b4226'; c.strokeRect(0, 0, W, H);
      c.strokeStyle = '#f2c94c'; c.lineWidth = 46; c.lineCap = 'round'; c.beginPath(); c.arc(W / 2, -40, 210, 0.55, 2.6); c.stroke();
      c.strokeStyle = '#6b4226'; c.lineWidth = 12; c.beginPath(); c.moveTo(W / 2 + 175, 80); c.lineTo(W / 2 + 195, 60); c.stroke();
    }, 512, 384), roughness: 0.9
  }));
  pic.position.set(-1.6, 2.6, -2.89); g.add(pic);
}
// ---------- EXTERIOR (mansão / carro / portão) ----------
{
  const g = new THREE.Group(); sets.outdoor = g; scene.add(g);
  const ground = add(g, CYL, M(0x7cb65a, 1), [0, -0.05, 0], [90, 0.1, 90]);
  add(g, BOX, M(0xc9c4ba, 0.9), [0, 0.01, -2], [5, 0.04, 24]);
  // mansão
  const m = new THREE.Group(); m.position.set(0, 0, -16); g.add(m);
  const wall = M(0xf3eee2, 0.85), roof = M(0xb5523b, 0.75), win = M(0x8fd0ec, 0.2, 0.1, { emissive: 0x2a6f8f, emissiveIntensity: 0.25 });
  add(m, BOX, wall, [0, 2.5, 0], [12, 5, 6]);
  add(m, BOX, wall, [0, 6.2, -0.5], [7, 2.4, 4.5]);
  add(m, BOX, wall, [-8, 1.8, 0.5], [4, 3.6, 5]);
  add(m, BOX, wall, [8, 1.8, 0.5], [4, 3.6, 5]);
  const r1 = add(m, new THREE.ConeGeometry(5.6, 2.2, 4), roof, [0, 8.5, -0.5], [1, 1, 0.65], [0, Math.PI / 4, 0]);
  for (const s of [-1, 1]) add(m, new THREE.ConeGeometry(3.3, 1.6, 4), roof, [s * 8, 4.4, 0.5], [1, 1, 1.1], [0, Math.PI / 4, 0]);
  add(m, BOX, M(0xe8e0cc, 0.8), [0, 5.05, 3.4], [8, 0.3, 1.4]);
  for (let i = 0; i < 6; i++) add(m, CYL, M(0xffffff, 0.6), [-3.5 + i * 1.4, 2.45, 3.6], [0.22, 4.9, 0.22]);
  for (let fl = 0; fl < 2; fl++) for (let i = 0; i < 6; i++) if (!(fl === 0 && (i === 2 || i === 3))) add(m, BOX, win, [-4.5 + i * 1.8, 1.3 + fl * 2.3, 3.02], [0.9, 1.3, 0.05]);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) add(m, BOX, win, [s * (7.2 + i * 1.6), 1.8, 3.02], [0.8, 1.2, 0.05]);
  for (let i = 0; i < 3; i++) add(m, BOX, win, [-2 + i * 2, 6.3, 1.77], [1, 1.1, 0.05]);
  add(m, BOX, M(0x6b3e26, 0.6), [0, 1.2, 3.03], [1.8, 2.4, 0.06]);
  add(m, SPH, M(0xd4a017, 0.3, 1), [0.5, 1.2, 3.1], [0.07, 0.07, 0.07]);
  // piscina
  add(g, BOX, M(0xffffff, 0.6), [-8.5, 0.05, -7], [6.4, 0.16, 4.4]);
  add(g, BOX, M(0x48b8e8, 0.15, 0.1, { emissive: 0x1a6f9a, emissiveIntensity: 0.25 }), [-8.5, 0.1, -7], [6, 0.12, 4]);
  // palmeiras
  const palm = (x, z, h = 4.5) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
    for (let i = 0; i < 6; i++) add(p, CYL, M(0x8b6b43, 0.9), [Math.sin(i * 0.35) * 0.25, i * h / 6 + 0.35, 0], [0.2 - i * 0.015, h / 6 + 0.05, 0.2 - i * 0.015], [0, 0, Math.cos(i) * 0.08]);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      add(p, SPH, M(0x3f9a45, 0.8), [Math.sin(a) * 0.9 + Math.sin(1.75) * 0.25, h + 0.1, Math.cos(a) * 0.9], [1.0, 0.1, 0.32], [0, a + Math.PI / 2, -0.35]);
    }
  };
  palm(-6, -10); palm(6, -10); palm(-11, -3, 5); palm(11, -4, 5); palm(14, -12, 5.5); palm(-14, -12, 5.5);
  // nuvens
  const cloudM = M(0xffffff, 1);
  const cloud = (x, y, z, s) => { for (let i = 0; i < 4; i++) { const m2 = add(g, SPH, cloudM, [x + i * 1.2 * s, y + (i % 2) * 0.4 * s, z], [1.2 * s, 0.8 * s, 0.8 * s]); m2.castShadow = false; } };
  cloud(-20, 18, -40, 2); cloud(12, 22, -45, 2.5); cloud(30, 15, -30, 1.8);
  // portão dourado
  const gate = new THREE.Group(); gate.position.set(0, 0, -3); g.add(gate); sets.gate = gate;
  const goldM = M(0xd9a92b, 0.3, 1);
  for (let i = -14; i <= 14; i++) add(gate, CYL, goldM, [i * 0.4, 1.0, 0], [0.04, 2.0, 0.04]);
  add(gate, BOX, goldM, [0, 2.0, 0], [11.4, 0.1, 0.1]);
  add(gate, BOX, goldM, [0, 0.3, 0], [11.4, 0.1, 0.1]);
  for (const s of [-1, 1]) add(gate, BOX, M(0xf3eee2, 0.8), [s * 5.9, 1.2, 0], [0.5, 2.4, 0.5]);
  // carro esportivo vermelho (genérico)
  const car = new THREE.Group(); g.add(car); sets.car = car;
  const red = M(0xd32f2f, 0.28, 0.35);
  add(car, BOX, red, [0, 0.55, 0], [2.0, 0.5, 4.4]);
  add(car, BOX, red, [0, 0.72, 1.4], [1.9, 0.22, 1.4], [0.12, 0, 0]);
  add(car, BOX, M(0x1b2330, 0.1, 0.5), [0, 0.98, -0.2], [1.7, 0.42, 1.9], [0, 0, 0]);
  add(car, BOX, red, [0, 1.2, -0.3], [1.65, 0.06, 1.3]);
  add(car, BOX, M(0x222222, 0.5), [0, 0.95, -2.15], [1.9, 0.08, 0.35]);
  for (const s of [-1, 1]) {
    add(car, BOX, M(0xfff6d0, 0.2, 0, { emissive: 0xfff2b0, emissiveIntensity: 1 }), [s * 0.7, 0.62, 2.21], [0.4, 0.12, 0.04]);
    add(car, BOX, M(0xff3030, 0.2, 0, { emissive: 0xff2020, emissiveIntensity: 1 }), [s * 0.7, 0.62, -2.21], [0.4, 0.1, 0.04]);
  }
  car.userData.wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 1.0, 0.4, sz * 1.4); car.add(w);
    add(w, CYL, M(0x151515, 0.8), [0, 0, 0], [0.4, 0.28, 0.4], [0, 0, Math.PI / 2]);
    add(w, CYL, M(0xc8c8c8, 0.3, 1), [sx * 0.15, 0, 0], [0.24, 0.02, 0.24], [0, 0, Math.PI / 2]);
    add(w, BOX, M(0x777777, 0.3, 1), [sx * 0.16, 0, 0], [0.02, 0.4, 0.06]);
    car.userData.wheels.push(w);
  }
}
// ---------- FACHADA DO MERCADO ----------
{
  const g = new THREE.Group(); g.position.set(60, 0, 0); sets.marketOut = g; scene.add(g);
  add(g, BOX, M(0xc9c4ba, 0.9), [0, 0.0, 0], [30, 0.1, 30]);
  add(g, BOX, M(0x7cb65a, 1), [0, -0.02, 10], [60, 0.05, 20]);
  add(g, BOX, M(0xf4d58d, 0.85), [0, 2.4, -6], [12, 4.8, 6]);
  add(g, BOX, M(0x9ad3e8, 0.15, 0.1, { emissive: 0x2a6f8f, emissiveIntensity: 0.3 }), [0, 1.3, -2.97], [8, 2.2, 0.05]);
  for (let i = 0; i < 10; i++) add(g, BOX, M(i % 2 ? 0xffffff : 0xd64545, 0.8), [-5.4 + i * 1.2, 2.85, -2.6], [1.2, 0.12, 0.9], [0.35, 0, 0]);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.25), new THREE.MeshStandardMaterial({ map: signTex(['MERCADO DO MACACO'], { bg: '#fff8e7', fg: '#c0392b', border: '#c0392b', w: 1024, h: 180, sizes: [120] }), roughness: 0.8 }));
  sign.position.set(0, 3.85, -2.95); g.add(sign);
  for (let i = 0; i < 4; i++) add(g, BOX, M(0x9aa3ad, 0.4, 0.6), [-4 + i * 0.8, 0.45, -1.2], [0.55, 0.5, 0.8]);
}
// ---------- INTERIOR DO MERCADO ----------
const hamMat = M(0xd77a6a, 0.55), hamCut = M(0xf2a99c, 0.6), boneM = M(0xf7f1e4, 0.6);
function makeHam(s = 1) {
  const h = new THREE.Group();
  add(h, SPH, hamMat, [0, 0, 0], [0.9 * s, 0.75 * s, 0.75 * s]);
  add(h, SPH, hamCut, [0.72 * s, 0, 0], [0.22 * s, 0.6 * s, 0.6 * s]);
  add(h, CYL, boneM, [-1.05 * s, 0, 0], [0.12 * s, 0.6 * s, 0.12 * s], [0, 0, Math.PI / 2]);
  add(h, SPH, boneM, [-1.38 * s, 0, 0], [0.17 * s, 0.17 * s, 0.17 * s]);
  return h;
}
{
  const g = new THREE.Group(); g.position.set(-60, 0, 0); sets.marketIn = g; scene.add(g);
  add(g, BOX, M(0xece6da, 0.5), [0, -0.05, 0], [20, 0.1, 20]);
  for (let i = -10; i <= 10; i++) add(g, BOX, M(0xd6cfc1, 0.5), [i, 0.002, 0], [0.03, 0.01, 20]);
  add(g, BOX, M(0xf2c46d, 0.9), [0, 3, -5], [20, 6, 0.2]);
  const r = rng(7), cols = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0xf4a261, 0x457b9d, 0x8ab17d, 0xb56576];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 3.2, 0, -1.5); g.add(sh);
    add(sh, BOX, M(0x8d99ae, 0.5, 0.4), [0, 1.3, 0], [0.9, 2.6, 6]);
    for (let lv = 0; lv < 4; lv++) {
      add(sh, BOX, M(0xbfc6d1, 0.4, 0.5), [-sx * 0.55, 0.3 + lv * 0.62, 0], [0.4, 0.05, 6]);
      for (let k = 0; k < 11; k++) add(sh, BOX, M(cols[Math.floor(r() * cols.length)], 0.7), [-sx * 0.6, 0.52 + lv * 0.62, -2.6 + k * 0.52], [0.3, 0.35 + r() * 0.08, 0.38]);
    }
  }
  const bigHam = makeHam(0.72); bigHam.position.set(0, 0.85, -0.3); g.add(bigHam); sets.bigHam = bigHam;
  const plate = add(g, CYL, M(0xffffff, 0.3), [0, 0.12, -0.3], [1.6, 0.1, 1.6]);
}
// ---------- VAZIO (cenas dramáticas) ----------
{
  const g = new THREE.Group(); sets.void = g; scene.add(g);
  const floor = add(g, CYL, M(0x22222c, 0.9), [0, -0.05, 0], [6, 0.1, 6]);
  sets.voidFloor = floor;
}

// ---------- dinheiro e presuntos voando ----------
const billTex = textTex((g, W, H) => {
  g.fillStyle = '#7cc48a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#2f7a4f'; g.lineWidth = 10; g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = '#2f7a4f'; g.beginPath(); g.arc(W / 2, H / 2, 40, 0, 7); g.fill();
  g.fillStyle = '#e8f6ea'; g.font = '900 54px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', W / 2, H / 2 + 3);
  g.fillStyle = '#2f7a4f'; g.font = '900 34px Inter'; g.fillText('100', 50, 36); g.fillText('100', W - 50, H - 34);
}, 256, 128);
const N_BILLS = 140;
const bills = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshStandardMaterial({ map: billTex, side: THREE.DoubleSide, roughness: 0.8 }), N_BILLS);
bills.castShadow = true; scene.add(bills);
const billR = []; { const r = rng(11); for (let i = 0; i < N_BILLS; i++) billR.push([r(), r(), r(), r(), r(), r()]); }
const dummy = new THREE.Object3D();
function updateBills(mode, t, o = {}) {
  bills.visible = !!mode;
  if (!mode) return;
  for (let i = 0; i < N_BILLS; i++) {
    const [a, b, c, d, e, f] = billR[i];
    if (mode === 'burst') {
      const dt = t - o.t0 - a * 0.25;
      if (dt < 0) { dummy.position.set(0, -50, 0); }
      else {
        const ang = b * Math.PI * 2, sp = 1.5 + c * 2.2;
        const vx = Math.cos(ang) * sp, vz = Math.sin(ang) * sp * 0.6, vy = 2.5 + d * 3;
        const k = 1 - Math.exp(-dt * 1.6);
        let y = o.origin.y + vy * k / 1.6 - 1.2 * dt * dt * 0.5 - 0.5 * dt;
        y = Math.max(o.floor ?? 0.02, y);
        dummy.position.set(o.origin.x + vx * k / 1.6 + Math.sin(dt * 3 + e * 6) * 0.15, y, o.origin.z + vz * k / 1.6);
      }
      dummy.rotation.set(t * (2 + e * 4) + a * 9, t * (1 + f * 3) + b * 9, c * 6);
    } else { // chuva
      const R = o.radius ?? 8, Hh = o.height ?? 9;
      const y = Hh - ((t * (0.9 + c * 0.8) + d * Hh) % Hh);
      dummy.position.set(o.center.x + (a - 0.5) * 2 * R + Math.sin(t * 2 + e * 9) * 0.3, o.center.y + y, o.center.z + (b - 0.5) * 2 * R * 0.7);
      dummy.rotation.set(t * (2 + e * 3) + a * 9, t * (1.5 + f * 2), c * 6);
    }
    dummy.scale.setScalar(o.scale ?? 1);
    dummy.updateMatrix(); bills.setMatrixAt(i, dummy.matrix);
  }
  bills.instanceMatrix.needsUpdate = true;
}
const hams = []; { for (let i = 0; i < 26; i++) { const h = makeHam(0.18); scene.add(h); hams.push(h); } }
const hamR = []; { const r = rng(21); for (let i = 0; i < 26; i++) hamR.push([r(), r(), r(), r()]); }
function updateHams(on, t, center) {
  hams.forEach((h, i) => {
    h.visible = on; if (!on) return;
    const [a, b, c, d] = hamR[i];
    const Hh = 7, y = Hh - ((t * (1.6 + c) + d * Hh) % Hh);
    h.position.set(center.x + (a - 0.5) * 7, y, center.z + (b - 0.5) * 4 - 0.5);
    h.rotation.set(t * 2 + a * 6, t * 1.4 + b * 6, c * 6);
  });
}
// gotas de suor
const sweat = []; for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(SPH, M(0x8fd3ff, 0.1, 0, { transparent: true, opacity: 0.9 })); s.scale.set(0.045, 0.07, 0.045); scene.add(s); sweat.push(s); }

// =========================================================
//   OVERLAYS HTML
// =========================================================
const $ = id => document.getElementById(id);
const el = { hook: $('hook'), cap: $('caption'), stamp: $('stamp'), phone: $('phone'), scr: document.querySelector('#phone .scr'), flash: $('flash'), tint: $('tint'), vig: $('vignette'), counter: $('counter'), cta: $('cta'), zzz: $('zzz') };
const capData = TL.segments.map((s, i) => {
  const words = s.caption.split(/\s+/);
  const w = words.map(x => x.length + 2); const tot = w.reduce((a, b) => a + b, 0);
  let acc = 0; const times = w.map(x => { const st = acc / tot; acc += x; return st; });
  const next = TL.segments[i + 1];
  return { ...s, words, times, until: next ? next.start - 0.05 : DUR };
});
let lastCapKey = '';
function updateCaption(t) {
  const seg = capData.find(s => t >= s.start - 0.08 && t < s.until);
  if (!seg) { if (lastCapKey) { el.cap.innerHTML = ''; lastCapKey = ''; } return; }
  const f = (t - seg.start) / (seg.end - seg.start);
  let idx = -1; seg.times.forEach((st, i) => { if (f >= st) idx = i; });
  if (f > 1) idx = seg.words.length;
  const key = seg.id + ':' + idx;
  if (key === lastCapKey) return;
  lastCapKey = key;
  let badge = '';
  if (seg.speaker === 'primo') badge = '<div style="margin-bottom:10px"><i style="font-style:normal;font-size:26px;background:#e88d3a;color:#fff;padding:6px 18px;border-radius:30px;-webkit-text-stroke:0">PRIMO SUMIDO</i></div>';
  if (seg.speaker === 'mae') badge = '<div style="margin-bottom:10px"><i style="font-style:normal;font-size:26px;background:#d9779b;color:#fff;padding:6px 18px;border-radius:30px;-webkit-text-stroke:0">MÃE</i></div>';
  el.cap.innerHTML = badge + seg.words.map((w, i) => `<span class="${i === idx ? 'on' : i < idx ? 'past' : 'fut'}">${w}</span>`).join(' ');
}
let phoneMode = '';
function setPhone(mode, html) {
  if (mode === phoneMode) return;
  phoneMode = mode; el.scr.innerHTML = html;
}
const fmt = n => 'R$ ' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',00';
const BANK_TOP = '<div class="bank-top"><div class="nm">BANCO BANANA</div><div class="hi">Olá, Macaquinho!</div></div>';
const show = (e, o, tf = '') => { e.style.opacity = o; e.style.transform = tf; };

// =========================================================
//   ILUMINAÇÃO POR CENA
// =========================================================
function lights(preset, k = 1) {
  spot.intensity = 0; lamp.intensity = 0; fill.intensity = 0.6;
  scene.fog = null;
  if (preset === 'room') {
    scene.background = new THREE.Color(0x101418);
    hemi.color.set(0xdfeaff); hemi.groundColor.set(0x6b5040); hemi.intensity = lerp(0.25, 0.85, k);
    sun.color.set(0xffe2b5); sun.intensity = lerp(0.25, 2.4, k);
    sun.position.set(3.5, 6, -9); sun.target.position.set(0, 0.5, -0.5);
    rim.intensity = 0.9; rim.position.set(-4, 4, -5); rim.target.position.set(0, 1, -1);
    lamp.position.set(1.7, 1.3, -2.0); lamp.intensity = lerp(4, 1.2, k);
    fill.intensity = lerp(0.5, 1.5, k);
    renderer.toneMappingExposure = 1.1 + k * 0.15;
  } else if (preset === 'outdoor') {
    scene.background = new THREE.Color(0x8ccff2);
    scene.fog = new THREE.Fog(0xa9dcf5, 40, 120);
    hemi.color.set(0xcfe9ff); hemi.groundColor.set(0x5d7a3e); hemi.intensity = 1.0;
    sun.color.set(0xfff1d6); sun.intensity = 2.6;
    rim.intensity = 1.0;
    renderer.toneMappingExposure = 1.0;
  } else if (preset === 'market') {
    scene.background = new THREE.Color(0xf2c46d);
    hemi.color.set(0xfff6e5); hemi.groundColor.set(0x9c8a6a); hemi.intensity = 1.1;
    sun.color.set(0xffffff); sun.intensity = 1.8;
    rim.intensity = 1.0;
    renderer.toneMappingExposure = 1.0;
  } else if (preset === 'void') {
    scene.background = new THREE.Color().setRGB(0.03 * k, 0.03 * k, 0.05 * k);
    hemi.color.set(0x8090c0); hemi.groundColor.set(0x101010); hemi.intensity = 0.25;
    sun.intensity = 0.0; rim.intensity = 2.2; rim.color.set(0xff5a5a);
    spot.intensity = 60; spot.color.set(0xfff0e0); fill.intensity = 0.25;
    renderer.toneMappingExposure = 1.0;
  } else if (preset === 'dream') {
    scene.background = new THREE.Color().setHSL(0.75 - k * 0.1, 0.45, 0.35 + k * 0.6);
    hemi.color.set(0xe0d0ff); hemi.groundColor.set(0x404060); hemi.intensity = 1.2;
    sun.intensity = 1.5; sun.color.set(0xf0e0ff);
    rim.intensity = 2.0; rim.color.set(0xb388ff);
    renderer.toneMappingExposure = 1.0;
  }
  if (preset !== 'void' && preset !== 'dream') rim.color.set(0xa9cfff);
}
function sunAt(target, off = V(8, 14, 9)) {
  sun.target.position.copy(target); sun.position.copy(target).add(off);
  rim.target.position.copy(target); rim.position.copy(target).add(V(-6, 5, -8));
}

// =========================================================
//   CÂMERA
// =========================================================
const shakeR = rng(99);
function cam(pos, look, fov = 38, shake = 0, t = 0) {
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.copy(pos);
  if (shake) camera.position.add(V(Math.sin(t * 61) * shake, Math.sin(t * 47 + 1) * shake, 0));
  camera.lookAt(look);
  fill.position.copy(camera.position).add(V(1.5, 2.5, 0)); fill.target.position.copy(look);
}
const headPos = c => { c.root.updateMatrixWorld(true); return c.head.getWorldPosition(V(0, 0, 0)); };

// =========================================================
//   CENAS
// =========================================================
function hideAll() {
  for (const k of ['bedroom', 'outdoor', 'marketOut', 'marketIn', 'void']) sets[k].visible = false;
  for (const c of allChars) { c.root.visible = false; c.phone.visible = false; c.root.position.set(0, 0, 0); c.root.rotation.set(0, 0, 0); c.root.scale.setScalar(1); }
  debtTag.visible = false; sweat.forEach(s => s.visible = false);
  updateBills(null); updateHams(false);
  sets.car.visible = true; sets.gate.visible = true;
  if (rich.acc.glasses) rich.acc.glasses.position.y = 0.05;
  canvas.style.filter = '';
  el.zzz.style.opacity = 0;
}

// ---------- 1) quarto: acorda milionário ----------
function shotBedroom1(t) {
  sets.bedroom.visible = true;
  const m = sm(P(t, 0.15, 1.5));
  lights('room', m);
  sets.bedroom.userData.skyMat.color.set(new THREE.Color(0x223061).lerp(new THREE.Color(0xffd29a), m));
  sunAt(V(0, 0.5, -0.8), V(3.5, 5.5, -8));
  const c = hero; c.root.visible = true;
  const s1 = S.s1.start, s2 = S.s2.start;
  const up = back(P(t, s1 - 0.1, s1 + 0.65));
  c.root.position.set(0, 0.69, -0.95);
  c.root.rotation.x = lerp(-1.38, 0, up);
  const tMoney = s1 + 2.3;
  const shock = sm(P(t, tMoney - 0.05, tMoney + 0.15)) * (1 - 0.6 * sm(P(t, tMoney + 1.4, tMoney + 2.0)));
  const jump = pulse(t, tMoney, 0.45) * 0.35;
  c.root.position.y += jump;
  const raise = sm(P(t, s1 + 0.7, s1 + 1.3));
  c.phone.visible = t > s1 + 0.75;
  // braço direito segura o celular, esquerdo esfrega os olhos durante s2
  const rub = t > s2 + 0.3 && t < S.s2.end - 1.2 ? Math.max(0, Math.sin((t - s2) * 4.5)) : 0;
  const armsP = [
    [[lerp(0.05, -0.95, raise), lerp(0, -0.3, raise), lerp(0.12, 0.25, raise)], lerp(-0.15, -1.05, raise)],
    [[lerp(0.05, -1.5, rub), 0, lerp(-0.12, -0.55, rub)], lerp(-0.15, -1.9, rub)]
  ];
  if (t > tMoney && t < s2) { armsP[1] = [[-2.6 + Math.sin(t * 14) * 0.2, 0, -0.5], -0.4]; }
  const sleeping = t < s1;
  const glitchT = S.s2.end - 1.35;
  pose(c, {
    t, talk: 0,
    lid: sleeping ? 1 : (t < s1 + 0.25 ? 0.6 : (t > s2 && t < glitchT ? (Math.abs(Math.sin(t * 9)) > 0.85 ? 1 : 0.05) : null)),
    eye: 1 + shock * 0.45 + (t > glitchT && t < s2 + 99 ? 0.25 : 0), open: shock * 0.9 + (t > glitchT ? 0.4 : 0),
    head: [lerp(0.1, 0.25, raise) - jump * 0.3, Math.sin(t * 2) * 0.05, rub * 0.1], look: [0, raise * -0.15],
    arms: armsP, body: [0, 0, 0]
  });
  c.phoneScreen.material.color.set(t > tMoney ? 0x7be0a6 : 0xeaf6ff);
  if (sleeping) el.zzz.style.opacity = 0.9, el.zzz.style.transform = `translate(${Math.sin(t * 3) * 10}px, ${-((t * 30) % 40)}px)`;
  // dinheiro explodindo
  if (t > tMoney - 0.1) updateBills('burst', t, { t0: tMoney, origin: V(0, 2.0, -0.4), floor: 0.82 });
  // câmera
  const hp = headPos(c);
  if (t < s2) {
    const k = sm(P(t, 0, s2));
    const pos = V(lerp(2.4, 0.9, k), lerp(2.6, 2.05, k), lerp(4.8, 2.3, k));
    cam(pos, V(lerp(0, hp.x, k), lerp(1.2, hp.y - 0.05, k), lerp(-1.2, hp.z, k)), 38, t > tMoney && t < tMoney + 0.4 ? 0.04 : 0, t);
  } else {
    const k = sm(P(t, s2, S.s3.start));
    const zoom = t > glitchT ? 0.25 : 0;
    cam(V(hp.x + lerp(0.9, 0.6, k), hp.y + 0.15, hp.z + lerp(2.7, 2.3, k) - zoom), V(hp.x - 0.05, hp.y - 0.2, hp.z), 38, t > glitchT ? 0.025 : 0, t);
  }
  // ---- overlays ----
  show(el.hook, 1 - sm(P(t, S.s2.start - 0.3, S.s2.start)), `scale(${1 + 0.04 * Math.sin(t * 6)})`);
  const pIn = back(P(t, s1 + 1.55, s1 + 1.9));
  if (t < s2) {
    const n = 1e9 * eo(P(t, s1 + 1.85, tMoney));
    setPhone('rich', BANK_TOP + '<div class="bank-body"><div class="lb">Saldo disponível</div><div class="bal pos" id="bal"></div><div class="row"><span>Pix recebido</span><span style="color:#1f7a4f">+ 1 bilhão</span></div><div class="btn">VER EXTRATO</div></div>');
    const b = document.getElementById('bal'); b.textContent = fmt(n);
    b.style.transform = `scale(${1 + pulse(t, tMoney, 0.35) * 0.18})`;
    show(el.phone, pIn * (1 - sm(P(t, s2 - 0.25, s2))), `translate(165px, -150px) scale(${0.5 * pIn}) rotate(${6 + (1 - pIn) * -8}deg)`);
  } else {
    // conferindo o saldo 15x
    const tc0 = s2 + 0.9, n = Math.min(15, Math.max(1, Math.floor((t - tc0) / 0.22) + 1));
    setPhone('check', BANK_TOP + '<div class="bank-body"><div class="lb">Saldo disponível</div><div class="bal pos">R$ 1.000.000.000,00</div><div class="btn" id="upd">ATUALIZAR</div></div>');
    const u = document.getElementById('upd');
    const press = t > tc0 && t < tc0 + 15 * 0.22 ? ((t - tc0) % 0.22) < 0.08 : false;
    u.style.transform = press ? 'scale(.92)' : ''; u.style.background = press ? '#1b5a42' : '';
    const pin = back(P(t, s2, s2 + 0.35));
    show(el.phone, pin * (1 - sm(P(t, S.s3.start - 0.2, S.s3.start))), `translate(170px, -160px) scale(${0.45 * pin}) rotate(6deg)`);
    const cin = back(P(t, tc0 - 0.1, tc0 + 0.15));
    el.counter.querySelector('.n').textContent = n + 'x';
    el.counter.querySelector('.n').style.transform = `scale(${1 + (press ? 0.15 : 0)})`;
    show(el.counter, cin * (t < glitchT ? 1 : 0), `translate(-430px, 470px) scale(${cin})`);
    if (t > glitchT) {
      // efeito "bugado"
      const j = Math.floor(t * 30);
      canvas.style.filter = `hue-rotate(${(j * 77) % 360}deg) contrast(1.3) saturate(1.4)`;
      el.stamp.innerHTML = 'BUGADO?!';
      show(el.stamp, 1, `translate(${(j * 37 % 21) - 10}px, ${(j * 53 % 17) - 8 + 150}px) rotate(-6deg) scale(1.1)`);
      el.stamp.style.color = j % 2 ? '#ff4d6d' : '#4dd6ff';
    }
  }
}

// ---------- 2) mansão / carro / mercado ----------
function shotRich(t) {
  sets.outdoor.visible = true; sets.marketOut.visible = true;
  lights('outdoor');
  const s = S.s3, d = s.end - s.start, f = (t - s.start) / d;
  const tCar = s.start + d * 0.36, tMkt = s.start + d * 0.62;
  const c = rich; c.root.visible = true;
  el.stamp.style.color = '#fff';
  if (t < tCar) {
    // mansão
    sunAt(V(0, 0, -6));
    sets.car.visible = false; sets.gate.visible = false;
    const k = sm(P(t, s.start - 0.1, tCar));
    c.root.position.set(0, Math.abs(Math.sin(t * 7)) * 0.25, 1.2);
    pose(c, { t, open: 0.6, arms: [[[-2.7 + Math.sin(t * 14) * 0.2, 0, 0.4], -0.3], [[-2.7 - Math.sin(t * 14) * 0.2, 0, -0.4], -0.3]], head: [-0.15, 0, Math.sin(t * 7) * 0.1] });
    cam(V(lerp(-2.0, 2.0, k), lerp(1.3, 2.6, k), lerp(5.5, 8.0, k)), V(0, lerp(2.4, 3.8, k), lerp(-2, -9, k)), 46);
    updateBills('rain', t, { center: V(0, 0, -5), radius: 7, height: 10 });
    stampText('MANSÃO', '✔ comprada', P(t, s.start + 0.1, s.start + 0.4), -340);
  } else if (t < tMkt) {
    // carro esportivo
    sunAt(V(0, 0, -2)); sets.gate.visible = false;
    const k = P(t, tCar, tMkt);
    const kk = eo(P(t, tCar - 0.1, tCar + 0.7));
    sets.car.position.set(lerp(-16, 0, kk), 0, -1.5);
    sets.car.rotation.y = Math.PI / 2 + Math.sin(kk * Math.PI) * -0.25;
    sets.car.userData.wheels.forEach(w => w.rotation.x = kk * 30);
    c.root.position.set(1.6, Math.abs(Math.sin(t * 7)) * 0.15, 1.2);
    c.root.rotation.y = -0.5;
    pose(c, { t, open: 0.5, arms: [[[-2.4, 0, 0.3], -0.6], [[0.1, 0, -0.15], -0.2]], head: [0, -0.3, 0] });
    cam(V(lerp(7.2, 6.4, k), 1.7, lerp(7.5, 6.8, k)), V(0.4, 0.9, -0.8), 42, kk < 1 && kk > 0.85 ? 0.03 : 0, t);
    stampText('CARRÃO', '✔ comprado', P(t, tCar + 0.05, tCar + 0.35), -340);
  } else {
    // mercado
    sets.outdoor.visible = false; sets.car.visible = false;
    const base = V(60, 0, 0);
    sunAt(base.clone().add(V(0, 0, -3)));
    const k = sm(P(t, tMkt, S.s4.start));
    c.root.position.set(59.0, 0, 3.0); c.root.rotation.y = 0.35;
    pose(c, { t, open: 0.35, arms: [[[-2.3, 0, -0.6], -0.1], [[0.1, 0, -0.15], -0.2]], head: [-0.05, 0.4, 0] });
    cam(V(lerp(60.6, 60.0, k), lerp(1.8, 2.3, k), lerp(11, 9.8, k)), V(60, lerp(2.3, 2.5, k), -2), 50);
    stampText('MERCADO', '✔ comprado', P(t, tMkt + 0.05, tMkt + 0.35), -340);
  }
  flashAt(t, [tCar, tMkt]);
}
function stampText(big, small, k, dy = 0, rot = -5) {
  el.stamp.innerHTML = big + (small ? `<small>${small}</small>` : '');
  const sc = back(k);
  show(el.stamp, clamp(k * 3), `translateY(${dy}px) rotate(${rot}deg) scale(${lerp(2.2, 1, sc)})`);
}
function flashAt(t, times, d = 0.18) {
  let f = 0; for (const x of times) if (t >= x && t < x + d) f = Math.max(f, 1 - (t - x) / d);
  el.flash.style.opacity = f * 0.85;
}

// ---------- 3) presunto infinito ----------
function shotMarket(t) {
  sets.marketIn.visible = true;
  lights('market');
  const base = V(-60, 0, 0);
  sunAt(base.clone(), V(4, 10, 8));
  const c = rich; c.root.visible = true;
  const s = S.s4.start;
  c.root.position.set(-60, 0, 0.75); c.root.rotation.y = Math.PI;  // de costas pra câmera? não: abraça o presunto de frente
  c.root.rotation.y = 0;
  c.root.position.set(-60 + 0.0, 0, 0.7);
  sets.bigHam.position.set(0, 0.85 + Math.sin(t * 3) * 0.03, -0.25);
  sets.bigHam.rotation.set(0, 0.25, 0.05);
  // abraço por trás do presunto: macaco atrás, presunto na frente
  c.root.position.set(-60, 0, -1.25);
  c.root.rotation.z = Math.sin(t * 3) * 0.06;
  pose(c, { t, lid: 0.82, open: 0.45, arms: [[[-1.2, 0, 0.75], -0.6], [[-1.2, 0, -0.75], -0.6]], head: [0.15, 0, Math.sin(t * 3) * 0.12] });
  updateHams(true, t, base);
  const k = sm(P(t, s - 0.1, S.s5.start));
  const a = lerp(-0.5, 0.35, k);
  cam(V(-60 + Math.sin(a) * 5.0, lerp(3.0, 2.7, k), Math.cos(a) * 5.0), V(-60, 1.45, -0.8), 42);
  el.stamp.style.color = '#fff';
  stampText('ESTOQUE DE PRESUNTO:', 'INFINITO', P(t, s + 0.6, s + 0.95), -360, -3);
  el.stamp.style.fontSize = '46px';
  flashAt(t, [s - 0.05]);
}

// ---------- 4) "mas calma... tem um problema" ----------
function shotProblem(t) {
  sets.void.visible = true;
  const s = S.s5.start;
  lights('void', 1);
  const c = rich; c.root.visible = true;
  spot.position.set(0, 7, 2); spot.target.position.set(0, 1, 0);
  rim.position.set(-3, 3, -4); rim.target.position.set(0, 1.4, 0);
  const k = sm(P(t, s - 0.2, S.s6.start));
  const slide = sm(P(t, s + 0.5, s + 0.9));
  c.acc.glasses.position.y = 0.05 - slide * 0.16;
  pose(c, { t, eye: 1.15, look: [Math.sin(t * 5) > 0 ? 0.35 : -0.35, 0], open: 0.15, arms: [[[0.1, 0, 0.15], -0.2], [[0.1, 0, -0.15], -0.2]], head: [0.05, 0, 0] });
  const hp = headPos(c);
  cam(V(0, lerp(1.9, hp.y + 0.05, k), lerp(5.5, 1.9, k)), V(0, lerp(1.4, hp.y - 0.02, k), 0), 38, t < s + 0.35 ? 0.04 : 0, t);
  el.tint.style.background = 'radial-gradient(ellipse at center, rgba(255,0,0,0) 40%, rgba(160,0,0,.55) 100%)';
  el.tint.style.opacity = 0.5 + 0.5 * Math.sin(t * 6) ** 2;
  el.stamp.style.color = '#ff4d4d';
  stampText('⚠ PROBLEMA ⚠', '', P(t, s + 0.15, s + 0.45), -380, 0);
  flashAt(t, [s - 0.05]);
}

// ---------- 5) parentes descobrem ----------
function shotGate(t) {
  sets.outdoor.visible = true; sets.car.visible = true;
  sets.car.position.set(-4, 0, -8); sets.car.rotation.y = 0.6;
  lights('outdoor'); sunAt(V(0, 0, -1));
  const s = S.s6.start;
  const c = rich; c.root.visible = true; c.root.position.set(0, 0, -4.6);
  pose(c, { t, eye: 1.35, open: 0.7, arms: [[[-0.4, 0, 0.9], -1.2], [[-0.4, 0, -0.9], -1.2]], head: [0, 0, 0] });
  crowd.forEach((p, i) => {
    p.root.visible = true;
    const r = (i % 4) - 1.5, row = Math.floor(i / 4);
    const k = eo(P(t, s - 0.4 + i * 0.05, s + 1.3 + row * 0.2));
    p.root.position.set(r * 1.25 + row * 0.5, Math.abs(Math.sin(t * 12 + i)) * 0.25 * (1 - k * 0.6), lerp(14 + row * 2, -2.1 + row * 1.3, k));
    p.root.rotation.y = Math.PI;
    pose(p, { t, open: 0.6, arms: [[[-2.6 + Math.sin(t * 12 + i) * 0.4, 0, 0.3], -0.3], [[-2.6 - Math.sin(t * 12 + i) * 0.4, 0, -0.3], -0.3]] });
  });
  const k = sm(P(t, s - 0.2, S.s7.start));
  cam(V(lerp(0, 1.2, k), lerp(5.5, 3.6, k), lerp(13, 7, k)), V(0, 1.2, -3), 40);
  el.stamp.style.color = '#ffd23f';
  stampText('OS PARENTES', 'DESCOBRIRAM!', P(t, s + 0.2, s + 0.5), -380);
  flashAt(t, [s - 0.05]);
}

// ---------- 6) primo sumido ----------
function shotCousin(t) {
  sets.outdoor.visible = true; sets.car.visible = false;
  lights('outdoor'); sunAt(V(3, 0, 0));
  const s = S.s7.start, sb = S.s7b.start;
  const c = cousin; c.root.visible = true; c.root.position.set(3, 0, 0); c.root.rotation.y = -0.15;
  c.phone.visible = true;
  pose(c, { t, talk: talkAmt(t, 's7b') * 0.9, open: 0.2, eye: 1.05,
    arms: [[[-0.95, 0, 0.3], -1.0], [[-2.6 + Math.sin(t * 10) * 0.35, 0, -0.5], -0.4]], head: [0.05, -0.1, Math.sin(t * 4) * 0.08] });
  crowd.slice(0, 4).forEach((p, i) => { p.root.visible = true; p.root.position.set(-1 + i * 1.3, 0, -2.1); p.root.rotation.y = Math.PI; pose(p, { t }); });
  const hp = headPos(c);
  const k = sm(P(t, s - 0.1, S.s8.start));
  cam(V(hp.x - 0.2, hp.y + 0.1, hp.z + lerp(4.0, 3.3, k)), V(hp.x + 0.45, hp.y - 0.45, hp.z), 40);
  // chat
  const pin = back(P(t, sb - 0.35, sb));
  setPhone('chat', '<div class="chat-top"><div class="av">P</div><div><div class="nm">Primo Jorginho</div><div class="st">visto por último há 8 anos</div></div></div><div class="chat-body"><div class="bub" id="b1">E aí, irmão, saudades! <span class="heart">&#10084;</span><small>08:01</small></div><div class="bub" id="b2" style="opacity:0">Tá precisando de um primo de confiança aí? kkk<small>08:01</small></div></div>');
  const b1 = back(P(t, sb, sb + 0.3)), b2 = back(P(t, sb + 1.2, sb + 1.5));
  document.getElementById('b1').style.transform = `scale(${b1})`;
  const e2 = document.getElementById('b2'); e2.style.opacity = b2 > 0 ? 1 : 0; e2.style.transform = `scale(${b2})`;
  show(el.phone, pin * (1 - sm(P(t, S.s8.start - 0.25, S.s8.start - 0.1))), `translate(145px, -40px) scale(${0.58 * pin}) rotate(${lerp(-10, 5, pin)}deg)`);
  el.stamp.style.color = '#fff';
  stampText('PRIMO SUMIDO', 'há 8 anos sem falar', P(t, s + 0.1, s + 0.4) * (t < sb - 0.4 ? 1 : 0), -380);
  flashAt(t, [s - 0.05]);
}

// ---------- 7) amigo com "proposta de sociedade" ----------
function shotFriend(t) {
  fsPlane.material.map = signProp;
  sets.outdoor.visible = true; sets.car.visible = true; sets.car.position.set(-5, 0, -6); sets.car.rotation.y = 0.9;
  lights('outdoor'); sunAt(V(0, 0, 0));
  const s = S.s8.start;
  const r = rich; r.root.visible = true; r.root.position.set(-0.85, 0, 0); r.root.rotation.y = 0.45;
  const f = friend; f.root.visible = true;
  const walk = eo(P(t, s - 0.2, s + 1.1));
  f.root.position.set(lerp(4, 0.9, walk), Math.abs(Math.sin(t * 9)) * 0.12 * (1 - walk), 0.1); f.root.rotation.y = -0.45;
  pose(f, { t, talk: t > s + 1.6 ? 0.5 : 0, open: 0.35, eye: 1.1,
    arms: [[[-1.25 + Math.sin(t * 3) * 0.08, 0, 0.35], -0.35], [[0.05, 0, -0.1], -0.1]], head: [0, -0.15, Math.sin(t * 5) * 0.08], legs: walk < 1 ? [Math.sin(t * 9) * 0.5, -Math.sin(t * 9) * 0.5] : null });
  upright(friendSign, f);
  pose(r, { t, lid: 0.55, look: [0.45, 0], arms: [[[0.1, 0, 0.15], -0.2], [[-0.5, 0, -0.9], -1.9]], head: [0.05, 0.25, 0.1] });
  const hpf = headPos(f);
  debtTag.visible = t > s + 1.2; debtTag.position.copy(hpf).add(V(0, 0.75 + Math.sin(t * 4) * 0.04, 0));
  debtTag.scale.set(1.25 * back(P(t, s + 1.2, s + 1.5)), 0.34 * back(P(t, s + 1.2, s + 1.5)), 1);
  const k = sm(P(t, s - 0.1, S.s9.start));
  cam(V(lerp(0.4, 0.2, k), 2.2, lerp(8.6, 7.8, k)), V(0.15, 1.6, 0), 40);
  el.stamp.style.color = '#fff';
  stampText('O AMIGO', 'que te deve R$ 20', P(t, s + 0.1, s + 0.4) * (t < s + 1.15 ? 1 : 0), -380);
  flashAt(t, [s - 0.05]);
}

// ---------- 8) mãe e a conta de luz ----------
function shotMom(t) {
  sets.outdoor.visible = true; sets.car.visible = false;
  lights('outdoor'); sunAt(V(0, 0, 0));
  const s = S.s9.start, sb = S.s9b.start;
  const r = rich; r.root.visible = true; r.root.position.set(-1.0, 0, 0); r.root.rotation.y = 0.5;
  const m = mom; m.root.visible = true; m.root.position.set(1.0, 0, 0.1); m.root.rotation.y = -0.5;
  const showBill = back(P(t, sb + 0.2, sb + 0.55));
  pose(m, { t, talk: talkAmt(t, 's9b'), eye: 1.05,
    arms: [[[lerp(0.1, -1.2, showBill), 0, lerp(0.15, -0.6, showBill)], lerp(-0.2, -0.3, showBill)], [[-0.4 + Math.sin(t * 6) * 0.25 * (t > sb ? 1 : 0), 0, -0.9], -1.6]],
    head: [0, -0.2, Math.sin(t * 5) * 0.06 * (t > sb ? 1 : 0)] });
  upright(bill, m);
  pose(r, { t, eye: 1.2 + showBill * 0.2, open: 0.3 + showBill * 0.4, arms: [[[0.1, 0, 0.15], -0.2], [[0.1, 0, -0.15], -0.2]], head: [0.05, 0.3, -0.08] });
  r.acc.glasses.position.y = 0.05 - showBill * 0.14;
  // suor
  const hpr = headPos(r);
  sweat.forEach((d, i) => {
    d.visible = t > sb + 0.6;
    const ph = ((t * 1.3 + i * 0.33) % 1);
    d.position.copy(hpr).add(V(-0.35 + i * 0.1, 0.25 - ph * 0.6, 0.2));
  });
  const k = sm(P(t, s - 0.1, S.s10.start));
  const hpm = headPos(m);
  const focus = sm(P(t, sb, sb + 0.6));
  cam(V(lerp(0.2, 0.3, focus), lerp(2.0, 1.9, focus), lerp(7.0, 5.9, focus) - k * 0.3), V(lerp(0, 0.15, focus), lerp(1.55, 1.6, focus), 0), 40);
  el.stamp.style.color = '#fff';
  stampText('MÃE', '', P(t, s + 0.05, s + 0.3) * (t < sb ? 1 : 0), -390);
  flashAt(t, [s - 0.05]);
}

// ---------- 9) "mas o pior vem agora..." (transição de sonho) ----------
function shotDream(t) {
  sets.void.visible = true;
  const s = S.s10.start, e = S.s11.start - 0.15;
  const k = P(t, s - 0.2, e);
  lights('dream', sm(k));
  sunAt(V(0, 0, 0), V(3, 8, 5));
  sets.voidFloor.visible = false;
  const c = rich; c.root.visible = true;
  c.root.rotation.y = k * 7; c.root.position.y = 0.6 + Math.sin(t * 3) * 0.1;
  c.root.scale.setScalar(1 - k * 0.3);
  pose(c, { t, lid: 0.7, open: 0.2, arms: [[[-0.6, 0, 0.6], -0.2], [[-0.6, 0, -0.6], -0.2]] });
  cam(V(Math.sin(t) * 0.3, 1.8, lerp(5, 3.2, k)), V(0, 1.4, 0), lerp(38, 60, k * k));
  canvas.style.filter = `blur(${k * k * 6}px) saturate(${1 + k})`;
  el.stamp.style.color = '#fff';
  stampText('MAS O PIOR', 'VEM AGORA…', P(t, s - 0.1, s + 0.25), -380, 0);
  el.flash.style.opacity = sm(P(t, e - 0.45, e));
}

// ---------- 10) acorda de verdade ----------
function shotWake(t) {
  sets.bedroom.visible = true; sets.voidFloor.visible = true;
  lights('room', 0.85);
  sets.bedroom.userData.skyMat.color.set(0xbfe3ff);
  sunAt(V(0, 0.5, -0.8), V(3.5, 5.5, -8));
  const s11 = S.s11.start, s12 = S.s12.start, s13 = S.s13.start;
  const c = hero; c.root.visible = true;
  const d11 = S.s11.end - s11;
  const tUp = s11 + d11 * 0.25, tPhone = s11 + d11 * 0.45, tApp = s11 + d11 * 0.72;
  const up = back(P(t, tUp - 0.2, tUp + 0.45));
  c.root.position.set(0, 0.69, -0.95); c.root.rotation.x = lerp(-1.38, 0, up);
  const raise = sm(P(t, tPhone - 0.1, tPhone + 0.4));
  c.phone.visible = t > tPhone - 0.1;
  const shock = sm(P(t, s12 - 0.05, s12 + 0.12));
  const palm = sm(P(t, s13 + 1.3, s13 + 1.6));
  const jump = pulse(t, s12, 0.4) * 0.3;
  c.root.position.y += jump;
  pose(c, { t, lid: t < s11 ? 1 : (t < s11 + 0.35 ? 0.55 : (palm > 0.5 ? 1 : null)), eye: 1 + shock * 0.55 - palm * 0.3, open: shock * 1.0 * (1 - palm * 0.6),
    head: [lerp(0.1, 0.25, raise) + palm * 0.25, (t > s13 + 0.3 && t < s13 + 1.3 ? 0.55 : 0), 0], look: [t > s13 + 0.3 && t < s13 + 1.3 ? 0.5 : 0, -0.1 * raise],
    arms: [[[lerp(0.05, -0.95, raise), lerp(0, -0.3, raise), lerp(0.12, 0.25, raise)], lerp(-0.15, -1.05, raise)],
           [[lerp(0.05, -1.75, palm), 0, lerp(-0.12, -0.35, palm)], lerp(-0.15, -1.85, palm)]] });
  c.phoneScreen.material.color.set(t > s12 ? 0xff9a9a : 0xeaf6ff);
  // amigo na janela
  fsPlane.material.map = signDebt;
  const f = friend; const fin = eo(P(t, s13 + 0.1, s13 + 0.7));
  f.root.visible = t > s13; f.root.position.set(1.6, lerp(-0.4, 0.75, fin), -4.0); f.root.rotation.y = 0;
  pose(f, { t, open: 0.5, talk: t > s13 + 0.7 && t < S.s13.end ? 0.6 : 0, eye: 1.1,
    arms: [[[-1.25, 0, 0.35], -0.35], [[-2.0 + Math.abs(Math.sin(t * 12)) * 0.4, 0, -0.3], -1.4]], head: [0, 0, Math.sin(t * 5) * 0.08] });
  upright(friendSign, f);
  // câmera
  const hp = headPos(c);
  if (t < s12) {
    const k = sm(P(t, s11 - 0.2, s12));
    cam(V(lerp(2.0, 0.8, k), lerp(2.6, 2.1, k), lerp(4.2, 2.2, k)), V(hp.x * k, lerp(1.2, hp.y, k), lerp(-1.2, hp.z, k)), 38);
  } else if (t < s13) {
    const z = eo(P(t, s12, s12 + 0.15));
    cam(V(hp.x + 0.45, hp.y + 0.12, hp.z + lerp(3.0, 2.0, z)), V(hp.x - 0.1, hp.y - 0.25, hp.z), 38, t < s12 + 0.4 ? 0.035 : 0, t);
  } else {
    const k = sm(P(t, s13, s13 + 0.8));
    cam(V(lerp(0.3, 0.5, k), lerp(hp.y, 2.2, k), lerp(hp.z + 1.4, 3.9, k)), V(lerp(hp.x, 0.85, k), lerp(hp.y, 1.85, k), lerp(hp.z, -1.6, k)), 40);
  }
  // celular
  const pin = back(P(t, tApp - 0.3, tApp));
  if (t < s12) {
    setPhone('load', BANK_TOP + '<div class="bank-body"><div class="lb">Carregando seu saldo…</div><div class="spinner" id="sp"></div></div>');
    document.getElementById('sp').style.transform = `rotate(${t * 720}deg)`;
  } else {
    setPhone('poor', BANK_TOP + '<div class="bank-body"><div class="lb">Saldo disponível</div><div class="bal neg" id="bal">R$ 0,00</div><div class="row" id="debt" style="opacity:0"><span>Dívida com amigo</span><b>- R$ 20,00</b></div><div class="btn" style="background:#9aa3ad">SALDO INSUFICIENTE</div></div>');
    const b = document.getElementById('bal'); b.style.transform = `scale(${1 + pulse(t, s12, 0.3) * 0.25})`;
    const dd = document.getElementById('debt'); const dk = back(P(t, s13 + 1.2, s13 + 1.5)); dd.style.opacity = dk > 0 ? 1 : 0; dd.style.transform = `scale(${dk})`;
  }
  const out = sm(P(t, S.s13.end + 0.3, S.s13.end + 0.7));
  const big = t >= s12 && t < s13;
  show(el.phone, pin * (1 - out), t < s13 ? `translate(165px, -150px) scale(${(big ? 0.55 : 0.5) * pin}) rotate(${big ? 6 + Math.sin(t * 40) * 2 * (t < s12 + 0.4 ? 1 : 0) : 6}deg)` : `translate(-185px, -190px) scale(${0.4 * pin}) rotate(-6deg)`);
  // textos
  el.stamp.style.color = '#fff';
  if (t > s12 + 0.25 && t < s13) stampText('ERA TUDO', 'UM SONHO', P(t, s12 + 0.25, s12 + 0.55), 330, -4);
  if (t > s13 + 0.6 && t < S.s13.end + 0.6) { el.stamp.style.color = '#ffd23f'; stampText('CADÊ MEUS R$ 20?', '', P(t, s13 + 0.6, s13 + 0.9), -400, 3); el.stamp.style.fontSize = '50px'; }
  // CTA final
  const ck = back(P(t, S.s13.end + 0.6, S.s13.end + 1.0));
  el.cta.innerHTML = 'E você?<br>Ia pagar os <b>R$ 20</b><br>do amigo?';
  show(el.cta, clamp(ck * 2), `scale(${ck}) rotate(-2deg)`);
  flashAt(t, [s11 - 0.15]);
  if (t < s11 - 0.15 + 0.4) el.flash.style.opacity = 1 - P(t, s11 - 0.15, s11 + 0.25);
  if (t < s11) { el.zzz.style.opacity = 0.9; el.zzz.style.transform = `translate(${Math.sin(t * 3) * 10}px, ${-((t * 30) % 40)}px)`; }
}

// =========================================================
function renderAt(t) {
  hideAll();
  // reset overlays
  for (const k of ['stamp', 'phone', 'counter', 'cta']) show(el[k], 0);
  el.hook.style.opacity = 0; el.flash.style.opacity = 0; el.tint.style.opacity = 0;
  el.stamp.style.fontSize = ''; el.stamp.style.color = '#fff';
  if (t < S.s3.start - 0.05) shotBedroom1(t);
  else if (t < S.s4.start - 0.05) shotRich(t);
  else if (t < S.s5.start - 0.05) shotMarket(t);
  else if (t < S.s6.start - 0.05) shotProblem(t);
  else if (t < S.s7.start - 0.05) shotGate(t);
  else if (t < S.s8.start - 0.05) shotCousin(t);
  else if (t < S.s9.start - 0.05) shotFriend(t);
  else if (t < S.s10.start - 0.05) shotMom(t);
  else if (t < S.s11.start - 0.15) shotDream(t);
  else shotWake(t);
  updateCaption(t);
  renderer.render(scene, camera);
}
window.renderAt = renderAt;
window.DURATION = DUR;
window.ready = true;
const q = new URLSearchParams(location.search);
if (q.has('t')) renderAt(parseFloat(q.get('t')));
else if (q.has('play')) { const t0 = performance.now(); const loop = () => { renderAt(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
