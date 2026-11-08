// Renderiza a animação quadro a quadro com Chromium headless e monta o MP4.
// Uso:  node render.mjs                -> vídeo completo (build/part*.mp4; o build.sh junta tudo)
//       node render.mjs --preview 3,12  -> PNGs de quadros soltos em build/preview/
//       node render.mjs --part 0/3      -> renderiza só uma fatia (para paralelizar)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const args = process.argv.slice(2);
const arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const DUR = await page.evaluate(() => window.DURATION);
const stage = await page.$('#stage');

async function frame(t) {
  await page.evaluate(t => window.renderAt(t), t);
  return stage.screenshot({ type: 'jpeg', quality: 93 });
}

if (arg('--preview')) {
  const dir = path.join(ROOT, 'build', 'preview'); fs.mkdirSync(dir, { recursive: true });
  for (const t of arg('--preview').split(',').map(Number)) {
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.jpg`), await frame(t));
  }
} else {
  const total = arg('--until') ? Math.ceil(parseFloat(arg('--until')) * FPS - 1e-6) : Math.ceil(DUR * FPS);
  const [pi, pn] = (arg('--part') || '0/1').split('/').map(Number);
  const a = Math.floor(total * pi / pn), b = Math.floor(total * (pi + 1) / pn);
  const out = path.join(ROOT, 'build', `part${pi}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = a; i < b; i++) {
    const buf = await frame(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - a) % 60 === 0) console.log(`[part ${pi}] quadro ${i - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`[part ${pi}] pronto: ${out}`);
}
await browser.close();
server.close();
