# v1.7.2 rest-on-screw：AE / 3D 导出里被托住的板在长时间托住期间位置不变，之后才掉落离开
# AE 关键帧精简误差 TOL.pos=0.25px，所以 AE 允许 <0.3px；3D 用原始样本要求完全不变
import sys, json, zipfile, struct, bisect
ae, e3 = sys.argv[1], sys.argv[2]
R = {}
def interp(T, V, t):
    if t <= T[0]: return V[0]
    if t >= T[-1]: return V[-1]
    i = bisect.bisect_right(T, t) - 1; u = (t - T[i]) / (T[i + 1] - T[i]); return [a + (b - a) * u for a, b in zip(V[i], V[i + 1])]
tl = json.load(zipfile.ZipFile(ae).open('timeline.json'))
ly = [l for c in tl['comps'] for l in c['layers'] if l['name'] in ('板块 1 运动', 'Plate 1 Motion')][0]
pos = ly['tr']['position']; t0 = ly['in']
T, V = (pos['t'], pos['v']) if isinstance(pos, dict) else ([t0], [pos])
land = interp(T, V, t0 + 1.2); hold = [interp(T, V, t0 + 1.2 + k * 0.1) for k in range(43)]
R['ae'] = {'in': round(t0, 3), 'out': round(ly['out'], 3), 'land': land, 'holdMaxD': max(abs(h[0] - land[0]) + abs(h[1] - land[1]) for h in hold), 'endY': interp(T, V, ly['out'])[1]}
R['ae']['ok'] = R['ae']['holdMaxD'] < 0.3 and ly['out'] - t0 > 6 and R['ae']['endY'] > land[1] + 200
z = zipfile.ZipFile(e3); sc = json.loads(z.read('scene3d.json'))
node = [n for n in sc['nodes'] if n['name'] == 'plate_01'][0]
glb = z.read('scene.glb'); jl = struct.unpack('<I', glb[12:16])[0]; gj = json.loads(glb[20:20 + jl]); bin0 = 20 + jl + 8
def acc(i):
    a = gj['accessors'][i]; bv = gj['bufferViews'][a['bufferView']]; n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    off = bin0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0); f = struct.unpack_from('<%df' % (a['count'] * n), glb, off)
    return [list(f[k * n:(k + 1) * n]) for k in range(a['count'])]
ni = [i for i, n in enumerate(gj['nodes']) if n.get('name') == 'plate_01'][0]
ch = [(an, c) for an in gj['animations'] for c in an['channels'] if c['target'].get('node') == ni and c['target']['path'] == 'translation'][0]
smp = ch[0]['samplers'][ch[1]['sampler']]; TT = [t[0] for t in acc(smp['input'])]; VV = acc(smp['output'])
f = node['fall']; l3 = interp(TT, VV, f + 1.2); h3 = [interp(TT, VV, f + 1.2 + k * 0.1) for k in range(43)]
R['e3d'] = {'fall': node['fall'], 'gone': node['gone'], 'holdMaxD': max(sum(abs(a - b) for a, b in zip(h, l3)) for h in h3), 'endZminusLand': interp(TT, VV, node['gone'])[2] - l3[2]}
R['e3d']['ok'] = node['gone'] is not None and node['gone'] - node['fall'] > 6 and R['e3d']['holdMaxD'] < 1e-4 and abs(R['e3d']['endZminusLand']) > 0.1
R['ok'] = R['ae']['ok'] and R['e3d']['ok']
print(json.dumps(R))
