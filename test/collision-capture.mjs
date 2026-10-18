// v1.6：自动通关中第一次“下落板撞到螺丝”的画面序列 → /tmp/collcap/*.jpg（用于 fall_collision.jpg 与 mp4）
import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
const r = await p.evaluate(() => new Promise(res => {
  const G = __game, ring = [], out = []; let hitPi = -1, post = 0; const t0 = performance.now();
  G.autoSolve();
  const tick = () => {
    const t = performance.now() - t0;
    const fr = { t: Math.round(t), url: stage.toDataURL('image/jpeg', 0.88), pose: G.plateVis.map(b => [b.s, +b.cx?.toFixed?.(1), +b.cy?.toFixed?.(1), +(b.ang * 180 / Math.PI).toFixed(1), b.hits]) };
    if (hitPi < 0) { ring.push(fr); if (ring.length > 14) ring.shift(); const k = G.plateVis.findIndex(b => b.s === 'fall' && b.hits > 0); if (k >= 0) { hitPi = k; out.push(...ring); } }
    else { out.push(fr); if (++post > 40) return res({ hitPi, frames: out, view: G.view(), poly: G.L.plates[hitPi].poly }); }
    if (t > 90000) return res({ hitPi, frames: [] });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
await b.close();
fs.rmSync('/tmp/collcap', { recursive: true, force: true }); fs.mkdirSync('/tmp/collcap');
r.frames.forEach((f, i) => fs.writeFileSync(`/tmp/collcap/${String(i).padStart(3, '0')}_${f.t}.jpg`, Buffer.from(f.url.split(',')[1], 'base64')));
fs.writeFileSync('/tmp/collcap/meta.json', JSON.stringify({ hitPi: r.hitPi, view: r.view, poly: r.poly, poses: r.frames.map(f => [f.t, f.pose[r.hitPi]]) }));
if (r.hitPi < 0) { console.log('COLLCAP FAIL: no falling plate hit a screw'); process.exit(1); }
console.log(JSON.stringify({ hitPi: r.hitPi, n: r.frames.length, poses: r.frames.filter((_, i) => i % 4 === 0).map(f => [f.t, f.pose[r.hitPi]]) }));
console.log('COLLCAP OK');
