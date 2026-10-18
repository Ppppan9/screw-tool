import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(400);
const url = 'data:image/png;base64,' + fs.readFileSync(`test/assets/shapes/star_hole.png`).toString('base64');
const r = await p.evaluate(([u, o]) => new Promise(res => { const im = new Image(); im.onload = () => { const S = { ...__game.S, ...o }; const out = []; for (let a = 0; a < 24; a++) { const t = performance.now(); try { const L = __game.buildOnce(im, S, S.shapeSeed + a * 977, Math.floor(a / 2)); out.push([a, Math.round(performance.now() - t), L.plates.length]); } catch (e) { out.push(String(e)); } } res(out); }; im.src = u; }), [url, { partStyle: 'voronoi', imgLayers: 2 }]);
console.log(r); await b.close();
