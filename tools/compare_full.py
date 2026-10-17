# 整帧对照：参考 2.93s | 工具开局 | |diff|×3（含 PSNR）→ screenshots/compare_ref_vs_tool.jpg
import sys, numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB').resize(a.size)
d = ImageChops.difference(a, b).point(lambda v: min(255, v * 3))
x = np.asarray(a, np.float32); y = np.asarray(b, np.float32); mse = ((x - y) ** 2).mean(); psnr = 10 * np.log10(255 ** 2 / mse)
W, H = a.size; o = Image.new('RGB', (W * 3 + 20, H + 40), (30, 30, 30)); o.paste(a, (0, 40)); o.paste(b, (W + 10, 40)); o.paste(d, (2 * W + 20, 40))
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 26)
except Exception: F = ImageFont.load_default()
dr = ImageDraw.Draw(o); dr.text((10, 6), 'REF 2.93s', fill='white', font=F); dr.text((W + 20, 6), 'TOOL start', fill='white', font=F); dr.text((2 * W + 30, 6), f'|diff| x3  PSNR {psnr:.2f} dB', fill='white', font=F)
o.resize((o.width // 2, o.height // 2), Image.LANCZOS).save(sys.argv[3], quality=88); print('PSNR %.2f' % psnr)
