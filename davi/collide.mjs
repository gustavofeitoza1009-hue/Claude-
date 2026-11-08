import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
const server = http.createServer((q, r) => { const p = path.join(ROOT, q.url.split('?')[0]); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'text/html' }); fs.createReadStream(p).pipe(r); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 720, height: 1280 } });
pg.on('pageerror', e => console.error(e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html`);
await pg.waitForFunction(() => window.ready);
const D = await pg.evaluate(() => window.DURATION);
const agg = {};
for (let t = 0; t < D; t += 0.1) {
  const r = await pg.evaluate(t => window.collisions(t), t);
  for (const x of r) { const k = `${x.who} braço${x.arm} ${x.part}`; (agg[k] ||= []).push([+t.toFixed(1), x.depth]); }
}
for (const [k, v] of Object.entries(agg)) console.log(k, `${v.length}x`, `t=${v[0][0]}..${v[v.length - 1][0]}`, `max=${Math.max(...v.map(x => x[1]))}`);
console.log('total', Object.values(agg).reduce((a, v) => a + v.length, 0));
await b.close(); server.close();
