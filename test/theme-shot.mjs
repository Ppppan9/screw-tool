// 经典款截图：node test/theme-shot.mjs [out.png] → 经典款开局画面（画布 720x1280）
import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(300);
await p.evaluate(() => __game.setTheme('classic')); await p.waitForTimeout(500);
const r = await p.evaluate(() => ({ theme: __game.S.theme, name: __game.L.name, plates: __game.L.plates.length, screws: __game.L.screws.length, w: stage.width, h: stage.height }));
console.log(JSON.stringify(r), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
fs.writeFileSync(process.argv[2] || '/tmp/classic.png', Buffer.from((await p.evaluate(() => stage.toDataURL())).split(',')[1], 'base64'));
await b.close();
