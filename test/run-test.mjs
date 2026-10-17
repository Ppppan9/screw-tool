// 自动通关 + 截图测试：node test/run-test.mjs
import { chromium } from 'playwright-core';
import fs from 'fs';
const url = 'file://' + process.cwd() + '/index.html';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(url); await p.waitForTimeout(500);
const shot = async (n) => fs.writeFileSync(`screenshots/${n}.png`, Buffer.from((await p.evaluate(() => document.getElementById('stage').toDataURL('image/png'))).split(',')[1], 'base64'));
await shot('tool_start');
// 上传测试手指图（仅测试用）
if (fs.existsSync('test/assets/stylus.png')) await p.setInputFiles('#file_handImg', 'test/assets/stylus.png');
await p.evaluate(() => { __game.set('handAnchorX', 0.04); __game.set('handAnchorY', 0.03); });
const t0 = Date.now();
await p.evaluate(() => { __game.startRec(); __game.autoSolve(); });
const marks = { 'tool_mid1': 2500, 'tool_mid2': 5600 }; const tk = {};
while (!(await p.evaluate(() => window.__finished))) {
  const el = Date.now() - t0;
  for (const [n, ms] of Object.entries(marks)) if (!tk[n] && el > ms) { tk[n] = 1; await shot(n); }
  if (el > 120000) throw new Error('timeout');
  await p.waitForTimeout(100);
}
const solveMs = Date.now() - t0;
await shot('tool_end');
await p.evaluate(() => __game.stopRec()); await p.waitForTimeout(800);
const rec = await p.evaluate(() => window.__lastRec);
const st = await p.evaluate(() => ({ removed: __game.st.removed.size, plates: __game.L.plates.length }));
console.log(JSON.stringify({ solveMs, st, rec, errs }));
await b.close();
if (errs.length || st.removed !== st.plates) process.exit(1);
