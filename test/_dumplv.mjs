import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(400);
const cases0 = [['heart', { partStyle: 'strip', baseFill: 'color' }], ['star_hole', { partStyle: 'voronoi', baseFill: 'color', imgLayers: 2 }], ['cat', { partStyle: 'strip', baseFill: 'image', plateTint: 'image', partAngle: 75, imgLayers: 2 }]];
for (const [n, opt] of cases0) {
  const url = 'data:image/png;base64,' + fs.readFileSync(`test/assets/shapes/${n}.png`).toString('base64');
  const r = await p.evaluate(([u, o]) => new Promise(res => { const im = new Image(); im.onload = () => { const S = { ...__game.S, ...o }; const out = []; for (let a = 0; a < 24; a++) { const L = __game.buildOnce(im, S, S.shapeSeed + a * 977, Math.floor(a / 2)); if (L) { delete L.tex; out.push(L); } } res({ S, out }); }; im.src = u; }), [url, opt]);
  fs.writeFileSync(`/tmp/lv_${n}.json`, JSON.stringify(r)); console.log(n, r.out.length);
}
await b.close();
