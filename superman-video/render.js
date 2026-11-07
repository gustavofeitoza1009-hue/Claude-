// Uso: node render.js frames [inicio] [fim] [fps]   -> build/frames/f_00000.jpg
//      node render.js stills 1.5 8.7 12          -> build/stills/t_1.5.jpg
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(rsp);
    }).listen(0, () => res(srv));
  });
}

(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
  page.on('pageerror', e => console.error('PAGEERR:', e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/scene.html`);
  await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
  const stage = await page.$('#stage');
  if (mode === 'stills') {
    fs.mkdirSync(path.join(ROOT, 'build/stills'), { recursive: true });
    for (const t of args.map(Number)) {
      await page.evaluate(t => window.renderAt(t), t);
      await stage.screenshot({ path: path.join(ROOT, `build/stills/t_${t}.jpg`), type: 'jpeg', quality: 85 });
    }
  } else {
    const fps = Number(args[2] || 30), f0 = Number(args[0] || 0), f1 = Number(args[1] || 70 * fps);
    fs.mkdirSync(path.join(ROOT, 'build/frames'), { recursive: true });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      await page.evaluate(t => window.renderAt(t), f / fps);
      await stage.screenshot({ path: path.join(ROOT, `build/frames/f_${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
      if ((f - f0) % 100 === 0) console.log(`frame ${f} (${((Date.now() - t0) / (f - f0 + 1)).toFixed(0)} ms/frame)`);
    }
  }
  await browser.close(); srv.close();
})();
