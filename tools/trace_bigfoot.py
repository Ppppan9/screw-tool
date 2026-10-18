# 经典款（大脚掌）：从朋友圈广告截图（ref/bigfoot/ref_720.png，游戏区 9:16 放大到 720x1280）分割板块与脚型 -> src/bigfoot_trace.json
# 种子 = 检测到的螺丝（Hough）按板分组；分隔 = 深色描边/缝；底板 = 黑色外轮廓内部（去掉右下角触控笔）
import cv2, numpy as np, json, sys
im = cv2.imread('ref/bigfoot/ref_720.png')
H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); V = hsv[..., 2].astype(int); S = hsv[..., 1].astype(int)
b, g, r = [im[..., i].astype(int) for i in range(3)]
pen = (b > r + 8) & (V < 140)
yy, xx = np.mgrid[0:H, 0:W]; pen &= (xx > 470) & (yy > 1030)  # 只在右下角触控笔区域
pen = cv2.dilate(pen.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
dark = (V < 75) & ~pen
dk = cv2.morphologyEx(dark.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
# 外部 = 从画面边缘泛洪到的非深色像素
ff = 255 - dk; ff[pen] = 0  # 触控笔当作障碍（它贴着脚跟描边），之后从脚型里去掉
mask = np.zeros((H + 2, W + 2), np.uint8)
out = ff.copy(); cv2.floodFill(out, mask, (5, 5), 128)
foot = ((out != 128) & ~pen).astype(np.uint8) * 255
foot = cv2.morphologyEx(foot, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(foot); k = 1 + np.argmax(st[1:, 4]); foot = (lab == k).astype(np.uint8) * 255
cs, _ = cv2.findContours(foot, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); c = max(cs, key=cv2.contourArea)
base = cv2.approxPolyDP(c, 1.5, True)[:, 0, :].tolist()
G = json.load(open('tools/bigfoot_groups.json'))
groups, empty = G['plates'], G['empty']
# v2：板 = 深色描边网络围出的连通区（螺丝圆盘先抹成板色；闭运算 5x5 封住描边小断口）；
# 两块板落进同一连通区（描边断开）时在该区内用螺丝做种子分水岭切开
dark = (V < 90).astype(np.uint8)
dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
for pl in groups:
    for p in pl['screws'] + pl.get('holes', []): cv2.circle(dark, (int(p[0]), int(p[1])), 29, 0, -1)
inner = ((dark == 0) & (foot > 0)).astype(np.uint8)
ncc, lab = cv2.connectedComponents(inner, connectivity=4)
ids = [lab[int(pl['screws'][0][1]), int(pl['screws'][0][0])] for pl in groups]
masks = []
for i, pl in enumerate(groups):
    comp = lab == ids[i]
    share = [j for j in range(len(groups)) if ids[j] == ids[i]]
    if len(share) > 1:
        # 分水岭在“暗度”图上（螺丝圆盘抹平）：先淹没亮的板面，边界落在残缺的深色描边上；区外不放标记
        dk = 255 - V.astype(np.uint8); dk = dk.copy()
        for pl2 in groups:
            for p in pl2['screws']: cv2.circle(dk, (int(p[0]), int(p[1])), 29, 0, -1)
        mk = np.zeros((H, W), np.int32)
        for j in share:
            for p in groups[j]['screws']: cv2.circle(mk, (int(p[0]), int(p[1])), 12, j + 2, -1)
        ws = cv2.watershed(cv2.cvtColor(cv2.GaussianBlur(dk, (3, 3), 0), cv2.COLOR_GRAY2BGR), mk); comp = comp & (ws == i + 2)
    m = comp.astype(np.uint8) * 255
    masks.append(cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))))
plates = []
# 连通区边界在描边内侧 → 每块板向外长 GROW px（盖住半条描边），但离其它板至少 KEEP px（不重叠，物理与手掌关卡一样留缝）
GROW, KEEP = 3, 3.5
D = np.stack([cv2.distanceTransform(255 - m, cv2.DIST_L2, 5) for m in masks])
for i, pl in enumerate(groups):
    others = np.delete(D, i, axis=0).min(0)
    m = ((D[i] <= GROW) & (D[i] + KEEP <= others) & (foot > 0)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    plates.append({'poly': cv2.approxPolyDP(c, 1.4, True)[:, 0, :].tolist(), 'screws': pl['screws'], 'holes': pl.get('holes', []), 'mat': pl.get('mat', 'metal'), 'name': pl.get('name', '')})
json.dump({'plates': plates, 'base': base, 'empty': empty, 'src': 'ref/bigfoot/ref_720.png'}, open('src/bigfoot_trace.json', 'w'))
vis = im.copy()
for i, p in enumerate(plates):
    col = tuple(int(v) for v in np.random.default_rng(i + 3).integers(0, 255, 3)); a = np.array(p['poly'])
    ov = vis.copy(); cv2.fillPoly(ov, [a], col); vis = cv2.addWeighted(ov, 0.45, vis, 0.55, 0); cv2.polylines(vis, [a], True, (0, 0, 255), 1)
cv2.polylines(vis, [np.array(base)], True, (0, 255, 0), 2)
cv2.imwrite(sys.argv[1] if len(sys.argv) > 1 else '/tmp/foot_ws.jpg', vis[100:1150, 120:620])
print(len(plates), 'plates', sum(len(p['screws']) for p in plates), 'screws')
