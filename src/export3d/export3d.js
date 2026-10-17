// v1.2：导出 3D 动画（glTF 2.0 .glb + Blender 脚本 + 音频 + timeline.json）
// 动画数据来自与 AE 导出相同的时间轴记录（每帧采样，按导出帧率重采样），所以掉落时刻（含螺丝阻挡判定）完全一致。
// 坐标：glTF Y 轴向上，单位米；1 设计像素(720×1280) = 1 mm。画面在 XZ 平面：X = (x−360)·PX，Z = (y−640)·PX（屏幕向下 = +Z）。
// 板块 = 由描绘出的多边形挤出的真实网格（厚度 = 板块厚度设置），顶面贴板面贴图（含自身孔）；底板 = 挤出的手形；背景 = 平面；
// 螺丝 = 简单 3D 网格（圆柱螺帽 + 十字槽两条凹槽 + 斜向螺杆）或贴图四边形（设置可选）。
// 2.5D 抬起：网页里螺丝“抬起”是画面向上偏移 lift 像素；3D 里螺帽同时升高 lift mm 并向 −Z 偏移 lift mm，螺杆从孔斜向连到螺帽，
// 俯视正交相机看到的位置与网页一致。下落的板抬高 30 mm、移动中的螺丝抬高 40 mm，保证与网页相同的遮挡顺序。
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { makeZip } from '../ae/zip.js';
import PY_TEXT from './blender_import.py';
import README_TEXT from './README_3D.md';
import { drawHole, drawScrew, rrPath } from '../render.js';
import { pointInPoly as pip } from '../level.js';

export const PX = 0.001;
const r5 = x => Math.round(x * 1e5) / 1e5;

export async function export3D({ S, ae, env, drawTextsTo, drawEndTo }) {
  const rec = env.rec; if (!rec) throw new Error('没有记录');
  const fps = +S.export3dFps || 30, L = rec.L, v = rec.view, D = ae.timeline.meta.duration, NF = Math.round(D * fps);
  const files = ae.fileList, fileMap = new Map(files.map(f => [f.name, f.data]));
  const P = (x, y) => [x * v.b + v.tx, y * v.b + v.ty];
  const X = x => (x - 360) * PX, Z = y => (y - 640) * PX;
  const root = new THREE.Scene(); root.name = 'screw_scene';
  const tracks = [], opacity = {}, nodes = [];
  const stats = { plates: 0, screws: 0, holes: 0, quads: 0, hand: 0 };
  const times = []; for (let f = 0; f <= NF; f++) times.push(r5(f / fps));
  function reduce(T, V, n) { const t2 = [], v2 = [], same = (i, j) => { for (let k = 0; k < n; k++) if (Math.abs(V[i * n + k] - V[j * n + k]) > 1e-7) return false; return true; }; for (let i = 0; i < T.length; i++) { if (i > 0 && i < T.length - 1 && same(i, i - 1) && same(i, i + 1)) continue; t2.push(T[i]); for (let k = 0; k < n; k++) v2.push(V[i * n + k]); } return { T: t2, V: v2 }; }
  function addTrack(name, prop, V, n, interp = THREE.InterpolateLinear) { const r = reduce(times, V, n); if (r.T.length === 1) { r.T.push(D); for (let k = 0; k < n; k++) r.V.push(r.V[k]); } const C = prop === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack; tracks.push(new C(name + '.' + prop, r.T, r.V, interp)); }
  const visTrack = (name, fn) => { const V = []; times.forEach(t => { const s = fn(t) ? 1 : 0; V.push(s, s, s); }); addTrack(name, 'scale', V, 3, THREE.InterpolateDiscrete); };
  // 样本序列线性插值（第 0 列为时间）
  function sampler(s) { let j = 0; return t => { if (t < s[j][0]) j = 0; while (j < s.length - 2 && s[j + 1][0] <= t) j++; const a = s[j], b = s[j + 1] || a, u = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0; return a.map((x, i) => x + (b[i] - x) * u); }; }
  function stepper(s) { let j = 0; return t => { if (t < s[j][0]) j = 0; while (j < s.length - 1 && s[j + 1][0] <= t + 1e-9) j++; return s[j]; }; }
  const texCache = new Map();
  const tex = (c, name) => { if (texCache.has(c)) return texCache.get(c); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.name = name; texCache.set(c, t); return t; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const basic = (name, o) => { const m = new THREE.MeshBasicMaterial(o); m.name = name; return m; };
  function quad(name, w, h, ax, ay, mat) { const g = new THREE.PlaneGeometry(w * PX, h * PX); g.rotateX(-Math.PI / 2); g.translate((w / 2 - ax) * PX, 0, (h / 2 - ay) * PX); const m = new THREE.Mesh(g, mat); m.name = name; stats.quads++; return m; }
  // UV 由顶点 XZ 位置决定：(x,z) 米 → 贴图覆盖的设计坐标矩形 [x0,y0,w,h]
  function planarUV(g, x0, y0, w, h, ox = 0, oz = 0) { const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { const dx = (p.getX(i) + ox) / PX + 360, dy = (p.getZ(i) + oz) / PX + 640; uv[i * 2] = (dx - x0) / w; uv[i * 2 + 1] = 1 - (dy - y0) / h; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  function extrude(pts, depth, holes = []) { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); holes.forEach(h => sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 4 }); g.rotateX(Math.PI / 2); return g; } // 顶面 y=0，向下挤出

  // ---------- 背景 / 底板 / 孔 ----------
  { const bg = quad('background', 720, 1280, 360, 640, basic('mat_background', { map: tex(env.bgCanvas, 'background') })); bg.position.y = -0.02; root.add(bg); }
  const BASE_T = 0.004;
  for (const [bi, poly] of L.base.polys.entries()) {
    const tp = (pl) => pl.map(([x, y]) => { const d = P(x, y); return [X(d[0]), Z(d[1])]; });
    const inn = (L.base.inner || []).filter(h => pip(h[0][0], h[0][1], poly));
    const g = extrude(tp(poly), BASE_T, inn.map(tp));
    planarUV(g, v.tx, v.ty, 720 * v.b, 1280 * v.b);
    const m = new THREE.Mesh(g, [basic('mat_base', { map: tex(env.baseCanvas, 'hand_base') }), basic('mat_base_side', { color: new THREE.Color(S.baseOutline) })]); m.name = 'base_hand' + (bi ? '_' + bi : ''); root.add(m);
  }
  const HR = S.holeSize / 2 + 4, holeC = mk(HR * 2 * 4, HR * 2 * 4); { const g = holeC.getContext('2d'); g.setTransform(4, 0, 0, 4, HR * 4, HR * 4); drawHole(g, 0, 0, S); }
  const holeMat = basic('mat_hole', { map: tex(holeC, 'hole'), transparent: true, depthWrite: false });
  L.holes.forEach((h, hi) => { const d = P(h.x, h.y), q = quad(`hole_${String(hi + 1).padStart(2, '0')}`, HR * 2 * v.b, HR * 2 * v.b, HR * v.b, HR * v.b, holeMat); q.position.set(X(d[0]), 0.0003, Z(d[1])); root.add(q); stats.holes++; });

  // ---------- 板块 ----------
  const TH = Math.max(1, S.plateThick) * PX, top = lay => lay < 0 ? 0 : (lay + 1) * (TH + 0.001);
  const plates = new THREE.Group(); plates.name = 'plates'; root.add(plates);
  L.plates.forEach((p, pi) => {
    const s = rec.plates[pi]; if (s[0][1] === 2) return;
    const sp = env.sprites[pi], c = mk(sp.c.width, sp.c.height), g2 = c.getContext('2d');
    g2.drawImage(sp.c, 0, 0); g2.setTransform(sp.c.width / sp.w, 0, 0, sp.c.height / sp.h, -sp.x * sp.c.width / sp.w, -sp.y * sp.c.height / sp.h); p.holes.forEach(h => drawHole(g2, L.holes[h].x, L.holes[h].y, S));
    const ctr = P(sp.x + sp.w / 2, sp.y + sp.h / 2), cx = X(ctr[0]), cz = Z(ctr[1]);
    const g = extrude(p.poly.map(([x, y]) => { const d = P(x, y); return [X(d[0]) - cx, Z(d[1]) - cz]; }), TH);
    const o = P(sp.x, sp.y); planarUV(g, o[0], o[1], sp.w * v.b, sp.h * v.b, cx, cz);
    const nm = `plate_${String(pi + 1).padStart(2, '0')}`;
    const vis = new THREE.Group(); vis.name = nm + '_vis'; plates.add(vis);
    const node = new THREE.Group(); node.name = nm; node.position.set(cx, top(p.layer), cz); node.userData = { layer: p.layer, screws: p.holes.length }; vis.add(node);
    const mesh = new THREE.Mesh(g, [basic('mat_' + nm, { map: tex(c, nm) }), basic('mat_plate_side', { color: new THREE.Color(S.plateShade) })]); mesh.name = nm + '_mesh'; node.add(mesh);
    // 贴面：完整板面贴图（含描边外半边与厚度边）作为透明四边形贴在顶面上，保证俯视画面与网页一致
    const skin = quad(nm + '_skin', sp.w * v.b, sp.h * v.b, sp.w * v.b / 2, sp.h * v.b / 2, basic('mat_' + nm + '_skin', { map: tex(c, nm), transparent: true, depthWrite: false })); skin.position.y = 0.0002; node.add(skin);
    stats.plates++;
    const at = sampler(s), st = stepper(s);
    visTrack(vis.name, t => st(t)[1] !== 2);
    const pv = [], qv = [], q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0);
    times.forEach(t => { const e = at(t), falling = st(t)[1] >= 1; pv.push(cx, top(p.layer) + (falling ? 0.03 : 0), cz + e[2] * v.b * PX); q.setFromAxisAngle(ax, -e[3]); qv.push(q.x, q.y, q.z, q.w); });
    addTrack(nm, 'position', pv, 3); if (s.some(e => e[3])) addTrack(nm, 'quaternion', qv, 4);
    const k = s.findIndex(e => e[1] === 1), kg = s.findIndex(e => e[1] === 2);
    if (S.fallFade && k >= 0) { opacity[nm + '_mesh'] = []; times.forEach(t => { const e = at(t); opacity[nm + '_mesh'].push([t, Math.round(Math.max(0, 1 - e[2] / 800) * 100) / 100]); }); }
    nodes.push({ name: nm, kind: 'plate', fall: k >= 0 ? r5(s[k][0]) : null, gone: kg >= 0 ? r5(s[kg][0]) : null });
  });

  // ---------- 螺丝 ----------
  const R = S.screwSize / 2, RS = 4, headC = mk((R + 3) * 2 * RS, (R + 3) * 2 * RS), crossC = mk(headC.width, headC.height), shC = mk(headC.width, headC.height);
  headC.getContext('2d').setTransform(RS, 0, 0, RS, (R + 3) * RS, (R + 3) * RS); drawScrew(headC.getContext('2d'), 0, 0, S, 0, 0, 1, 'head');
  crossC.getContext('2d').setTransform(RS, 0, 0, RS, (R + 3) * RS, (R + 3) * RS); drawScrew(crossC.getContext('2d'), 0, 0, S, 0, 0, 1, 'cross');
  shC.getContext('2d').setTransform(RS, 0, 0, RS, (R + 3) * RS, (R + 3) * RS); drawScrew(shC.getContext('2d'), 0, -2, S, 0, 0, 1, 'shadow');
  const quadMode = S.export3dScrew === 'quad', Rb = R * v.b, HW = (R + 3) * v.b;
  const headMat = basic('mat_screw_head', { map: tex(headC, 'screw_head'), transparent: true }), crossMat = basic('mat_screw_cross', { color: new THREE.Color(S.screwCross) }), crossTexMat = basic('mat_screw_cross_tex', { map: tex(crossC, 'screw_cross'), transparent: true, depthWrite: false });
  const sideMat = basic('mat_screw_side', { color: new THREE.Color(S.screwDark) }), shankMat = basic('mat_screw_shank', { color: new THREE.Color(S.screwColor) });
  const headGeo = (() => { const g = new THREE.CylinderGeometry(Rb * PX, Rb * PX, 0.003, 32); g.translate(0, 0.0015, 0); planarUV(g, -HW, -HW, HW * 2, HW * 2, 0, 0); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) / PX + HW) / (HW * 2), 1 - (p.getZ(i) / PX + HW) / (HW * 2)); return g; })();
  const slotL = Rb * (S.crossLen ?? 0.62) * 2 * PX, slotT = Rb * (S.crossW ?? 0.34) * 0.85 * PX; // 与 2D 十字槽同参数（M-C）
  const shankGeo = new THREE.CylinderGeometry(Rb * 0.42 * PX, Rb * 0.42 * PX, 1, 12).translate(0, 0.5, 0);
  const screws = new THREE.Group(); screws.name = 'screws'; root.add(screws);
  rec.screws.forEach((s, si) => {
    const nm = `screw_${String(si + 1).padStart(2, '0')}`, at = sampler(s), st = stepper(s);
    const node = new THREE.Group(); node.name = nm; screws.add(node); stats.screws++;
    const head = new THREE.Group(); head.name = nm + '_head'; node.add(head);
    if (quadMode) head.add(quad(nm + '_head_quad', HW * 2, HW * 2, HW, HW, headMat));
    else { const hm = new THREE.Mesh(headGeo, [sideMat, headMat, sideMat]); hm.name = nm + '_head_mesh'; head.add(hm); }
    const cross = new THREE.Group(); cross.name = nm + '_cross'; cross.position.y = 0.0032; head.add(cross);
    if (quadMode) cross.add(quad(nm + '_cross_quad', HW * 2, HW * 2, HW, HW, crossTexMat));
    else for (const [w, d, k] of [[slotL, slotT, 'a'], [slotT, slotL, 'b']]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0006, d), crossMat); b.name = `${nm}_cross_${k}`; cross.add(b); }
    const shank = new THREE.Group(); shank.name = nm + '_shank'; shank.rotation.x = -Math.PI / 4; node.add(shank);
    const sm = new THREE.Mesh(shankGeo, shankMat); sm.name = nm + '_shank_mesh'; shank.add(sm);
    const shadow = quad(nm + '_shadow', HW * 2, HW * 2, HW, HW, basic('mat_' + nm + '_shadow', { map: tex(shC, 'screw_shadow'), transparent: true, depthWrite: false, opacity: 0 })); node.add(shadow);
    const pv = [], hp = [], hs = [], cq = [], ss = [], sp2 = [], q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0), op = [];
    times.forEach(t => {
      const e = at(t), mv = st(t)[1] === 1, d = P(e[2], e[3]), lift = e[5] * v.b * PX, sc = e[6];
      const lay = mv ? 99 : st(t)[7]; const y0 = mv ? top(Math.max(-1, ...L.plates.map(p => p.layer))) + 0.04 : top(lay);
      pv.push(X(d[0]), y0, Z(d[1]));
      hp.push(0, lift, -lift); hs.push(sc, sc, sc);
      q.setFromAxisAngle(ax, -e[4]); cq.push(q.x, q.y, q.z, q.w);
      const len = e[5] > 0.5 ? lift * Math.SQRT2 : 0; ss.push(sc, len, sc);
      sp2.push(lift * 0.25, -0.0002, 0); op.push([t, e[5] > 0.5 ? Math.round(Math.min(0.35, e[5] / 60) * 1000) / 1000 : 0]);
    });
    addTrack(nm, 'position', pv, 3); addTrack(head.name, 'position', hp, 3); addTrack(head.name, 'scale', hs, 3); addTrack(cross.name, 'quaternion', cq, 4); addTrack(shank.name, 'scale', ss, 3); addTrack(shadow.name, 'position', sp2, 3);
    const r = reduce(op.map(o => o[0]), op.map(o => o[1]), 1); opacity[shadow.name] = r.T.map((t, i) => [t, r.V[i]]);
    nodes.push({ name: nm, kind: 'screw', moves: s.filter((e, i) => i && e[1] === 1 && s[i - 1][1] === 0).length });
  });

  // ---------- 文字 / 结束卡 / 手指（贴图四边形）----------
  const full = fn => { const c = mk(720 * 2, 1280 * 2), g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); fn(g); return c; };
  if (S.discShow || S.vertShow) { const q = quad('overlay_text', 720, 1280, 360, 640, basic('mat_overlay_text', { map: tex(full(drawTextsTo), 'text'), transparent: true, depthWrite: false })); q.position.y = 0.07; root.add(q); }
  const endS = rec.end; if (endS.some(e => e[1] > 0)) {
    // 压暗层单独做成黑色实色面（Blender 脚本按 sRGB 等效换算不透明度），内容（按钮+文字）为贴图面
    const dim = quad('end_card_dim', 720, 1700, 360, 840, basic('mat_end_card_dim', { color: 0x000000, transparent: true, depthWrite: false, opacity: 0.55 }));
    const q = quad('end_card', 720, 1280, 360, 640, basic('mat_end_card', { map: tex(full(g => drawEndTo(g, 1, true)), 'end_card'), transparent: true, depthWrite: false })); q.position.y = 0.001;
    const vis = new THREE.Group(); vis.name = 'end_card_vis'; vis.position.y = 0.075; vis.add(dim, q); root.add(vis);
    const at = sampler(endS); visTrack(vis.name, t => at(t)[1] > 0.001);
    const ok = reduce(times, times.map(t => Math.round(at(t)[1] * 100) / 100), 1);
    opacity.end_card = ok.T.map((t, i) => [t, ok.V[i]]); opacity.end_card_dim = ok.T.map((t, i) => [t, Math.round(ok.V[i] * 55) / 100]);
    nodes.push({ name: 'end_card_dim', kind: 'solid' });
  }
  if (env.handImg && S.export3dHand !== false && rec.hand.some(e => e[4])) {
    const im = env.handImg, c = mk(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0);
    const vis = new THREE.Group(); vis.name = 'hand_vis'; vis.position.y = 0.08; root.add(vis);
    const node = new THREE.Group(); node.name = 'hand'; vis.add(node);
    node.add(quad('hand_quad', im.width, im.height, S.handAnchorX * im.width, S.handAnchorY * im.height, basic('mat_hand', { map: tex(c, 'hand'), transparent: true, depthWrite: false })));
    const at = sampler(rec.hand), st = stepper(rec.hand); visTrack(vis.name, t => !!st(t)[4]);
    const pv = [], sv = []; times.forEach(t => { const e = st(t)[4] ? at(t) : st(t); pv.push(X(e[1]), 0, Z(e[2])); sv.push(e[3], 1, e[3]); });
    addTrack('hand', 'position', pv, 3); addTrack('hand', 'scale', sv, 3); stats.hand = 1;
  }

  // ---------- 相机 ----------
  // three r160 GLTFExporter 把 xmag/ymag 写成 right*2 / top*2，这里传 1/4 使写出值 = 半宽/半高
  const cam = new THREE.OrthographicCamera(-720 / 4 * PX, 720 / 4 * PX, 1280 / 4 * PX, -1280 / 4 * PX, 0.01, 50);
  cam.name = 'camera_ortho_topdown'; cam.position.set(0, 10, 0); cam.rotation.set(-Math.PI / 2, 0, 0); root.add(cam);
  const clip = new THREE.AnimationClip('screw_game', D, tracks);
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, animations: [clip], onlyVisible: false, trs: true });
  // 音频
  const tl = ae.timeline, assetById = new Map(tl.assets.map(a => [a.id, a])), sfxC = tl.comps.find(c => c.id === 'sfx'), mixA = tl.assets.find(a => a.id === 'mix');
  const audio = []; if (sfxC) for (const l of sfxC.layers) { const a = assetById.get(l.src.asset); if (a) audio.push({ file: a.file, t: l.start || 0, name: l.name }); }
  const scene3d = {
    tool: 'screw-tool', format: 'export3d/1', fps, frames: NF + 1, frameStart: 0, frameEnd: NF, duration: D, width: 720, height: 1280, screwMode: quadMode ? 'quad' : 'mesh', screwBlock: !!S.screwBlock,
    units: { px: PX, note: '1 设计像素 = 1 mm；Y 轴向上；画面在 XZ 平面，屏幕右 = +X，屏幕下 = +Z' },
    camera: { name: cam.name, type: 'orthographic', xmag: 0.36, ymag: 0.64, orthoScale: 1.28, position: [0, 10, 0] },
    visibility: '*_vis 节点 scale=1 显示 / 0 隐藏（STEP）', opacity, nodes, audio, mix: mixA ? { file: mixA.file, t: 0 } : null, stats: { ...stats, tracks: tracks.length },
  };
  const enc = new TextEncoder();
  const out = [{ name: 'scene.glb', data: new Uint8Array(glb) }, { name: 'scene3d.json', data: enc.encode(JSON.stringify(scene3d)) }, { name: 'timeline.json', data: fileMap.get('timeline.json') }, { name: 'blender_import.py', data: enc.encode(PY_TEXT) }, { name: 'README_3D.md', data: enc.encode(README_TEXT) }, ...files.filter(f => f.name.startsWith('audio/'))];
  const d = new Date(), p2 = x => String(x).padStart(2, '0'), stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return { blob: makeZip(out), name: `screw_3d_export_${stamp}.zip`, stats: scene3d.stats, duration: D, fps, glbSize: glb.byteLength };
}
