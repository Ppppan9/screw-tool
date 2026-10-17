// v1.4.2：打开页面 / 重新开始 / 自动通关 都不应自动开始 AE 记录或 MediaRecorder 录制
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } }); // 全新 localStorage
await ctx.addInitScript(() => { window.__mrCount = 0; const O = window.MediaRecorder; if (O) window.MediaRecorder = class extends O { constructor(...a) { super(...a); window.__mrCount++; } }; if (O) window.MediaRecorder.isTypeSupported = O.isTypeSupported.bind(O); });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(1500);
const st = async (tag) => p.evaluate(tag => ({ tag, ae: __game.aeActive(), mr: !!__game.mediaRec, mrCount: window.__mrCount, btn: (document.getElementById('btn_aeToggle') || {}).textContent, rec: document.getElementById('btnRec').textContent }), tag);
const out = [await st('load')];
await p.evaluate(() => __game.newGame()); await p.waitForTimeout(800); out.push(await st('newGame'));
await p.evaluate(() => { __game.S.autoSpeed = 3; __game.autoSolve(); }); await p.waitForTimeout(4000); out.push(await st('autoSolve'));
await p.evaluate(() => __game.autoSolve()); // 停止自动通关
const exp = await p.evaluate(async () => { const r = await __game.doExportAE(false); return { r: r === null, toast: document.getElementById('toast').textContent }; });
out.push({ tag: 'exportWithoutRec', ...exp });
await p.evaluate(() => __game.aeStart()); await p.waitForTimeout(500); await p.evaluate(() => __game.newGame()); await p.waitForTimeout(800); out.push(await st('aeStart+newGame'));
const ae2 = await p.evaluate(async () => { __game.aeStop(); const r = await __game.doExportAE(false); return { ok: !!(r && r.stats), frames: __game.aeLastRec && __game.aeLastRec.frames }; });
out.push({ tag: 'stop+export', ...ae2 });
await b.close();
console.log(JSON.stringify(out, null, 1), errs);
const ok = out.slice(0, 3).every(s => !s.ae && !s.mr && s.mrCount === 0 && s.btn.includes('开始记录')) && exp.r && exp.toast.includes('请先') && out[4].ae && ae2.ok && !errs.length;
console.log(ok ? 'NOAUTOREC OK' : 'NOAUTOREC FAIL'); process.exit(ok ? 0 : 1);
