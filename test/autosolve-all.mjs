// v1.7：参考/随机/图形关卡全程自动通关，检查没有板卡在画面上（npm run test:autoall）
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const cases = [['reference', {}], ['random', { seed: 1 }], ['random', { seed: 7 }], ['random', { seed: 42, genLayers: 3 }], ['image', {}], ['reference', { theme: 'classic' }]]; // v1.8：经典款大脚掌
let fails = 0; const only = process.env.CASES ? process.env.CASES.split(',').map(Number) : null;
for (const [ci, [level, extra]] of cases.entries()) {
  if (only && !only.includes(ci)) continue;
  const p = await b.newPage({ viewport: { width: 900, height: 1300 } });
  p.on('console', m => { if (/MISPREDICT|Error/.test(m.text())) console.log('  [page]', m.text().slice(0, 600)); });
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(300);
  const r = await p.evaluate(([level, extra]) => new Promise(res => {
    const G = __game; if (extra.theme) G.setTheme(extra.theme); for (const k in extra) if (k !== 'theme') G.S[k] = extra[k]; G.set('level', level); G.newGame();
    const t0 = performance.now(); let maxFall = 0, swingSync = 0; const angs = new Map();
    window.__DBGP = 1; G.autoSolve();
    const tick = () => {
      const pv = G.plateVis, t = performance.now() - t0;
      maxFall = Math.max(maxFall, pv.filter(b => b.s === 'fall').length);
      G.st.swing.forEach((sw, pi) => { if (Math.abs(sw.ang) < 16.9 * Math.PI / 180 && !angs.has(pi)) { angs.set(pi, +(sw.ang * 57.2958).toFixed(1)); swingSync++; } });
      const fin = window.__finished && pv.every(b => b.s === 'gone');
      if (fin || t > 240000) return res({ fin: !!fin, ms: Math.round(t), plates: pv.length, removed: G.st.removed.size, onScreen: pv.filter(b => b.s !== 'gone').map(b => b.s), maxFallTogether: maxFall, ppHits: pv.reduce((s, b) => s + b.pHits, 0), psHits: pv.reduce((s, b) => s + b.hits, 0), platesHitPlate: pv.filter(b => b.pHits > 0).length, platesHitScrew: pv.filter(b => b.hits > 0).length, ghosts: pv.filter(b => b.ghost).length, ppGhosts: G.world.ppGhosts || 0, rested: pv.filter(b => b.everRest).length, swingSyncedAngles: [...angs.values()], auto: window.__autoStats });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [level, extra]);
  const ok = r.fin && r.removed === r.plates && r.ghosts === 0 && !!r.auto && !r.auto.nudge && !r.auto.abort && !r.auto.mispredict;
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + level + JSON.stringify(extra) + ' ' + JSON.stringify(r));
  await p.close();
}
await b.close();
console.log(fails ? 'AUTOALL FAIL' : 'AUTOALL OK'); process.exit(fails ? 1 : 0);
