// 自动通关全关卡 → 记录时间轴（每 N 帧截取一张网页画面）→ 导出 AE zip（/workspace/screw_ae_sample.zip）
// 同时可导出 3D zip（E3D=1）。环境：AE_OUT（截图目录，默认 /tmp/screw_ae）
import { chromium } from 'playwright-core';
import fs from 'fs';
const OUT = process.env.AE_OUT || '/tmp/screw_ae'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + '/snaps', { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(400);
if (fs.existsSync('test/assets/stylus.png')) await p.setInputFiles('#file_handImage', 'test/assets/stylus.png');
await p.evaluate(() => { __game.set('handAnchorX', 0.04); __game.set('handAnchorY', 0.03); __game.set('endCard', true); __game.set('discShow', true); __game.set('autoSpeed', 1.6); window.__aeSnapEvery = +(new URLSearchParams('').get('x') || 0); });
await p.evaluate(n => { window.__aeSnapEvery = n; __game.autoSolve(); __game.aeRec.rec.snapEvery = n; __game.aeRec.rec.maxSnaps = 60; }, +(process.env.SNAP_EVERY || 45));
const t0 = Date.now();
while (!(await p.evaluate(() => window.__finished))) { if (Date.now() - t0 > 150000) throw new Error('timeout'); await p.waitForTimeout(200); }
await p.waitForTimeout(3500); // 结束卡 + 尾巴
const info = await p.evaluate(async () => {
  const r = await __game.doExportAE(false); const rec = __game.aeRec.rec;
  const buf = new Uint8Array(await r.blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { zip: btoa(bin), name: r.name, stats: r.stats, files: r.files, duration: r.timeline.meta.duration, snaps: rec.snaps.map(s => ({ t: s.t, url: s.url })), st: { removed: __game.st.removed.size, plates: __game.L.plates.length } };
});
fs.writeFileSync('/workspace/screw_ae_sample.zip', Buffer.from(info.zip, 'base64'));
const map = {}; info.snaps.forEach((s, i) => { const f = String(i).padStart(3, '0') + '.png'; fs.writeFileSync(`${OUT}/snaps/${f}`, Buffer.from(s.url.split(',')[1], 'base64')); map[f] = s.t; });
fs.writeFileSync(`${OUT}/snaps/snaps.json`, JSON.stringify(map));
if (process.env.E3D) {
  const e3 = await p.evaluate(async () => { const r = await __game.doExport3D(false); const buf = new Uint8Array(await r.blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return { zip: btoa(bin), stats: r.stats, duration: r.duration, fps: r.fps }; });
  fs.writeFileSync('/workspace/screw_3d_sample.zip', Buffer.from(e3.zip, 'base64'));
  fs.writeFileSync(`${OUT}/e3d.json`, JSON.stringify({ stats: e3.stats, duration: e3.duration, fps: e3.fps }));
  console.log('3D', JSON.stringify({ stats: e3.stats, duration: e3.duration }));
}
console.log(JSON.stringify({ name: info.name, stats: info.stats, files: info.files, duration: info.duration, snaps: info.snaps.length, st: info.st, errs }));
await b.close();
if (errs.length || info.st.removed !== info.st.plates) process.exit(1);
