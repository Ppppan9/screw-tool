import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(400);
const r = await p.evaluate(() => ({ w: stage.width, h: stage.height, hole: __game.L.holes[29], S: [__game.S.boardScale, __game.S.boardOffX] }));
console.log(JSON.stringify(r));
fs.writeFileSync(process.argv[2] || '/tmp/shot.png', Buffer.from((await p.evaluate(() => stage.toDataURL())).split(',')[1], 'base64'));
await b.close();
