# 背景：玩法段多帧，逐像素只取“绿色背景”样本求中位数（去掉触控笔/真手）；手掌区域用周围颜色归一化模糊填充 + 纸纹噪点 -> src/bg_ref.jpg
import cv2, numpy as np, glob
fs = sorted(glob.glob('ref/frames/g_*.jpg'))[::6]
st = np.stack([cv2.imread(f) for f in fs]).astype(np.float32)
hsv = np.stack([cv2.cvtColor(cv2.imread(f), cv2.COLOR_BGR2HSV) for f in fs])
green = (hsv[..., 0] > 35) & (hsv[..., 0] < 90) & (hsv[..., 1] > 25)
st[~green] = np.nan
med = np.nanmedian(st, axis=0)
known = ~np.isnan(med[..., 0])
hm = cv2.dilate(cv2.imread('/tmp/handmask.png', 0), np.ones((15, 15), np.uint8)) > 0
known &= ~hm
known &= np.nan_to_num(med).mean(-1) > 70
known = cv2.erode(known.astype(np.uint8), np.ones((5,5),np.uint8)) > 0
med = np.nan_to_num(med)
w = known.astype(np.float32)
blur = lambda a: cv2.GaussianBlur(a, (0, 0), 35)
fill = np.stack([blur(med[..., c] * w) for c in range(3)], -1) / (blur(w)[..., None] + 1e-6)
b2 = lambda a: cv2.GaussianBlur(a, (0, 0), 140)
fill2 = np.stack([b2(med[..., c] * w) for c in range(3)], -1) / (b2(w)[..., None] + 1e-6)
bw = np.clip(blur(w) * 8, 0, 1)[..., None]
fill = fill * bw + fill2 * (1 - bw)
rng = np.random.default_rng(1)
fine = rng.normal(0, 7, med.shape[:2])[..., None]
out = np.where(known[..., None], med, fill + fine)
out = np.clip(out, 0, 255).astype(np.uint8)
# 接缝柔化
edge = cv2.GaussianBlur((~known).astype(np.float32), (0, 0), 3)[..., None]
out = (out * (1 - edge * 0.0) ).astype(np.uint8)
cv2.imwrite('src/bg_ref.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 80])
cv2.imwrite('/tmp/bg_small2.jpg', cv2.resize(out, (360, 640)))
