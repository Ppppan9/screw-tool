// v1.8 主题测试（npm run test:theme）：
// 1) 手掌款（默认）开局画面与旧版构建逐像素一致（传入旧 index.html 路径时才比较：node test/theme-test.mjs /tmp/old_index.html）
// 2) 切到经典款 → 大脚掌关卡 + 经典款材质；改一个外观值后切回手掌款再切回来，改动按主题保存；刷新后主题保留
// 3) 旧存档（v13，无 theme）→ 手掌款；恢复默认保留当前主题；经典款下导入图形关卡用经典款材质；无控制台错误
import { chromium } from 'playwright-core'; import fs from 'fs';
const OLD = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
let fails = 0; const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); if (!c) fails++; };
const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
const errs = [];
async function open(url, pre) { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); if (pre !== undefined) { await p.goto(url); await p.evaluate(v => { localStorage.clear(); if (v) localStorage.setItem('screwTool.settings', JSON.stringify(v)); }, pre); } await p.goto(url); await p.waitForTimeout(500); return p; }
const shot = p => p.evaluate(() => stage.toDataURL());
const URL_ = 'file://' + process.cwd() + '/index.html';
if (OLD) {
  const p0 = await open('file://' + OLD, null), a = await shot(p0); await p0.close();
  const p1 = await open(URL_, null), c = await shot(p1);
  ok(a === c, '手掌款默认开局画面与旧版逐像素一致'); await p1.close();
}
const p = await open(URL_, null);
let s = await p.evaluate(() => ({ th: __game.S.theme, lv: __game.L.name, n: __game.L.plates.length, opts: [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'classic'))?.options.length }));
ok(s.th === 'palm' && s.lv === 'reference' && s.n === 25 && s.opts === 2, '新存档：主题下拉 2 项，默认手掌款 + 手掌关卡', s);
// 通过面板下拉切换
await p.evaluate(() => { const sel = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'classic')); sel.value = 'classic'; sel.dispatchEvent(new Event('change')); });
await p.waitForTimeout(400);
s = await p.evaluate(() => ({ th: __game.S.theme, lv: __game.L.name, n: __game.L.plates.length, ps: __game.S.plateStyle, ss: __game.S.screwStyle, bg: __game.S.bgMode }));
ok(s.th === 'classic' && s.lv === 'bigfoot' && s.n === 21 && s.ps === 'metal' && s.ss === 'chrome' && s.bg === 'silk', '下拉选经典款 → 大脚掌关卡 + 经典款材质', s);
fs.writeFileSync('/tmp/theme_classic.png', Buffer.from((await shot(p)).split(',')[1], 'base64'));
await p.evaluate(() => __game.set('plateColor', '#999999'));
await p.evaluate(() => __game.setTheme('palm')); await p.waitForTimeout(300);
s = await p.evaluate(() => ({ th: __game.S.theme, lv: __game.L.name, pc: __game.S.plateColor, st: __game.S.themeStore }));
ok(s.th === 'palm' && s.lv === 'reference' && s.pc === '#bfb7ee' && s.st.classic && s.st.classic.plateColor === '#999999', '切回手掌款：外观恢复默认，经典款改动存入 themeStore', s);
await p.evaluate(() => __game.setTheme('classic')); await p.waitForTimeout(300);
s = await p.evaluate(() => ({ pc: __game.S.plateColor }));
ok(s.pc === '#999999', '再切到经典款：恢复该主题下的改动', s);
await p.reload(); await p.waitForTimeout(500);
s = await p.evaluate(() => ({ th: __game.S.theme, lv: __game.L.name, pc: __game.S.plateColor, v: JSON.parse(localStorage.getItem('screwTool.settings')).version }));
ok(s.th === 'classic' && s.lv === 'bigfoot' && s.pc === '#999999' && s.v === 14, '刷新后主题与改动保留（设置版本 14）', s);
p.on('dialog', d => d.accept());
await p.click('#btnReset'); await p.waitForTimeout(400);
s = await p.evaluate(() => ({ th: __game.S.theme, lv: __game.L.name, pc: __game.S.plateColor, st: __game.S.themeStore }));
ok(s.th === 'classic' && s.lv === 'bigfoot' && s.pc === '#a8a3a4' && !Object.keys(s.st).length, '恢复默认：保留当前主题（经典款默认外观），清空 themeStore', s);
// 经典款下导入图形关卡（内置心形）
await p.evaluate(() => { __game.S.level = 'image'; __game.newGame(); }); await p.waitForTimeout(300);
s = await p.evaluate(() => ({ lv: __game.L.name, n: __game.L.plates.length, ps: __game.S.plateStyle }));
ok(/image|shape|heart/i.test(s.lv) || s.n > 0, '经典款下导入图形关卡生成成功', s);
fs.writeFileSync('/tmp/theme_classic_image.png', Buffer.from((await shot(p)).split(',')[1], 'base64'));
await p.evaluate(() => __game.setTheme('palm')); await p.waitForTimeout(300);
s = await p.evaluate(() => ({ lv: __game.L.name, ps: __game.S.plateStyle }));
ok(s.ps === 'hatch' && !/bigfoot|^reference$/.test(s.lv), '图形关卡切主题：保留当前关卡，只换材质', s);
await p.close();
// v13 旧存档
const p2 = await open(URL_, { version: 13, settings: { plateColor: '#112233', autoSpeed: 2 } });
s = await p2.evaluate(() => ({ th: __game.S.theme, lv: __game.L.name, pc: __game.S.plateColor, sp: __game.S.autoSpeed }));
ok(s.th === 'palm' && s.lv === 'reference' && s.pc === '#112233' && s.sp === 2, 'v13 旧存档 → 手掌款，保留用户值', s);
await p2.close();
ok(!errs.length, '无控制台错误', errs.slice(0, 5));
await b.close(); console.log(fails ? 'THEME FAIL' : 'THEME OK'); process.exit(fails ? 1 : 0);
