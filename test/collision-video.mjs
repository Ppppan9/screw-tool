// v1.7：自动通关逐帧抓取画面 + 每帧板状态（/tmp/pvid/），用于 screw_plate_collision.mp4 和 plate_plate_collision.jpg
// 用法：node test/collision-video.mjs [level] [秒数]
import { chromium } from 'playwright-core'; import fs from 'fs';
const level = process.argv[2] || 'reference', secs = +(process.argv[3] || 30), out = process.env.OUT || '/tmp/pvid';
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 900, height: 1300 } });
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(300);
await p.evaluate(([level, secs]) => {
  const G = __game; if (G.S.level !== level) G.set('level', level); G.newGame();
  window.__F = []; window.__done = false; const t0 = performance.now(); let last = -1e9;
  G.autoSolve();
  const tick = () => {
    const t = performance.now() - t0;
    if (t - last >= 33) { last = t; window.__F.push({ t: Math.round(t), url: stage.toDataURL('image/jpeg', 0.8), pv: G.plateVis.map(b => [b.s, Math.round(b.cx || 0), Math.round(b.cy || 0), +(b.ang * 57.2958).toFixed(1), b.pHits, b.hits, b.ghost ? 1 : 0]) }); }
    if (t > secs * 1000 || (window.__finished && G.plateVis.every(b => b.s === 'gone'))) { window.__done = true; return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, [level, secs]);
let n = 0; const meta = [];
while (true) {
  const { fr, done } = await p.evaluate(() => { const fr = window.__F; window.__F = []; return { fr, done: window.__done }; });
  for (const f of fr) { fs.writeFileSync(`${out}/${String(n).padStart(5, '0')}.jpg`, Buffer.from(f.url.split(',')[1], 'base64')); meta.push({ t: f.t, pv: f.pv }); n++; }
  if (done) break; await p.waitForTimeout(400);
}
fs.writeFileSync(`${out}/meta.json`, JSON.stringify(meta));
await b.close(); console.log('frames', n, 'last t', meta.at(-1)?.t);
