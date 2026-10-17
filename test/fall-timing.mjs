// 板掉落时机：记录自动通关中第一次掉落前后的帧（点击→拧出→板开始下落）
import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(400);
const r = await p.evaluate(() => new Promise(res => {
  const G = __game, fr = []; let tLift = null, tFall = null, liftSi = -1; const t0 = performance.now();
  G.autoSolve();
  const tick = () => {
    const t = performance.now() - t0;
    G.screwVis.forEach((v, si) => { if (v.anim && v.anim.k === 'lift' && tLift === null) { tLift = t; liftSi = si; } });
    if (tLift !== null && tFall === null && G.plateVis.some(q => q.s === 'falling')) tFall = t;
    if (tLift !== null && G.screwVis[liftSi] && !G.screwVis[liftSi].anim && tFall === null) { tLift = null; liftSi = -1; }
    if (tLift !== null) fr.push([t - tLift, stage.toDataURL('image/jpeg', 0.8), G.plateVis.map(q => q.s).join('')]);
    if (tFall !== null && t - tFall > 350) return res({ tLift, tFall, fr });
    if (t > 60000) return res({ tLift, tFall, fr: [] });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
await b.close();
const want = [0, 67, 133, 167, 200, 267, 333];
fs.mkdirSync('/tmp/tooltf', { recursive: true });
want.forEach((w, i) => { const f = r.fr.reduce((a, c) => Math.abs(c[0] - w) < Math.abs(a[0] - w) ? c : a); fs.writeFileSync(`/tmp/tooltf/${i}.jpg`, Buffer.from(f[1].split(',')[1], 'base64')); });
console.log(JSON.stringify({ fallAfterLiftMs: Math.round(r.tFall - r.tLift), frames: r.fr.length }));
