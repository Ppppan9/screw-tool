// 图形关卡生成耗时基准：直接调用 levelFromImage（不走 UI），打印每次尝试耗时
import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(400);
const cases0 = [['heart', { partStyle: 'strip', baseFill: 'color' }], ['star_hole', { partStyle: 'voronoi', baseFill: 'color', imgLayers: 2 }], ['cat', { partStyle: 'strip', baseFill: 'image', plateTint: 'image', partAngle: 75, imgLayers: 2 }]];
const ONLY = process.env.ONLY; const cases = ONLY ? cases0.filter(c => ONLY.split(',').includes(c[0])) : cases0;
for (const [n, opt] of cases) {
  const url = 'data:image/png;base64,' + fs.readFileSync(`test/assets/shapes/${n}.png`).toString('base64');
  const r = await p.evaluate(([u, o]) => new Promise(res => { const im = new Image(); im.onload = () => { const S = { ...__game.S, ...o }; const t0 = performance.now(); const L = __game.levelFromImage(im, S); res({ ms: Math.round(performance.now() - t0), name: L.name, attempts: L.attempts, plates: L.plates.length, holes: L.holes.length, screws: L.screws.length, log: L.genLog }); }; im.src = u; }), [url, opt]);
  console.log(n, JSON.stringify(r));
}
await b.close();
