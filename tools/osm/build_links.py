# 把 OpenStreetMap 的聖安德魯斯老球場資料轉成遊戲用的球洞資料
# 輸入：standrews_raw.json（高爾夫圖徵）、standrews_rel.json（關係型球道，含成員座標）、standrews_extra.json（小溪、建築）
# 輸出：../../src/game/links_data.js
# 地圖資料 © OpenStreetMap contributors（ODbL）
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
raw = json.load(open(os.path.join(HERE, 'standrews_raw.json')))['elements']
extra = json.load(open(os.path.join(HERE, 'standrews_extra.json')))['elements']
# 關係型圖徵（球道多為多段線組成）要另外帶成員座標，覆蓋掉 raw 裡沒有成員的那幾筆
rel = {e['id']: e for e in json.load(open(os.path.join(HERE, 'standrews_rel.json')))['elements']}
raw = [rel.get(e['id'], e) if e['type'] == 'relation' else e for e in raw]

LAT0, LON0 = 56.3437, -2.8028  # 原點：第 1 洞發球台附近
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
def xy(p): return ((p['lon'] - LON0) * KX, (p['lat'] - LAT0) * KY)  # x 往東、y 往北（公尺）

# 老球場 18 洞的中心線（way id 由查詢結果確認）
OLD = {236999244, 236999252, 236999260, 236999250, 236999245, 236999263, 294611909, 294611910, 294611911, 294611912,
       294611914, 294611915, 294611917, 294611919, 294611923, 294611927, 236999254, 236999246}
holes = sorted([e for e in raw if e['id'] in OLD], key=lambda e: int(e['tags']['ref']))
assert len(holes) == 18

def rings(e):  # 取出多邊形外環
    if e['type'] == 'way':
        g = [xy(p) for p in e['geometry']]
        return [g] if len(g) >= 4 else []
    segs = [[xy(p) for p in m['geometry']] for m in e.get('members', []) if m.get('role') in ('outer', '') and m.get('geometry')]
    out = []
    while segs:  # 把多段線頭尾相接成封閉的環
        cur = segs.pop(0)
        while math.dist(cur[0], cur[-1]) > 1:
            nxt = next((s2 for s2 in segs if math.dist(s2[0], cur[-1]) < 1 or math.dist(s2[-1], cur[-1]) < 1), None)
            if not nxt: break
            segs.remove(nxt)
            cur += (nxt if math.dist(nxt[0], cur[-1]) < 1 else nxt[::-1])[1:]
        if len(cur) >= 4 and math.dist(cur[0], cur[-1]) < 1: out.append(cur)
    return out
def area_centroid(r):
    a = cx = cy = 0
    for i in range(len(r) - 1):
        x0, y0 = r[i]; x1, y1 = r[i + 1]; c = x0 * y1 - x1 * y0
        a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    a /= 2
    if abs(a) < 1e-6: return 0, r[0]
    return abs(a), (cx / (6 * a), cy / (6 * a))
def inside(pt, r):
    x, y = pt; c = False
    for i in range(len(r) - 1):
        x0, y0 = r[i]; x1, y1 = r[i + 1]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0: c = not c
    return c
def seg_dist(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; l2 = dx * dx + dy * dy or 1
    u = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
    return math.dist(p, (a[0] + dx * u, a[1] + dy * u))
def line_dist(p, line): return min(seg_dist(p, line[i], line[i + 1]) for i in range(len(line) - 1))
def simplify(r, eps):  # Douglas-Peucker
    if len(r) < 3: return r
    a, b = r[0], r[-1]; best, bi = 0, 0
    for i in range(1, len(r) - 1):
        d = seg_dist(r[i], a, b)
        if d > best: best, bi = d, i
    if best <= eps: return [a, b]
    return simplify(r[:bi + 1], eps)[:-1] + simplify(r[bi:], eps)
def simp_ring(r, eps):
    h = len(r) // 2
    return simplify(r[:h + 1], eps)[:-1] + simplify(r[h:], eps)

lines = [[xy(p) for p in h['geometry']] for h in holes]
near_course = lambda p, d: any(line_dist(p, l) < d for l in lines)

fairways, greens, bunkers = [], [], []
for e in raw:
    kind = e['tags'].get('golf')
    if kind not in ('fairway', 'green', 'bunker'): continue
    for r in rings(e):
        a, c = area_centroid(r)
        if a < 2: continue
        if kind == 'fairway' and (near_course(c, 70) or any(near_course(p, 25) for p in r[::4])): fairways.append(r)
        if kind == 'green' and near_course(c, 45): greens.append((r, a, c))
        if kind == 'bunker' and near_course(c, 62): bunkers.append((r, a, c))
burn = [[xy(p) for p in e['geometry']] for e in extra if e['tags'].get('waterway') == 'stream' and e['tags'].get('tunnel') != 'culvert']
town = area_centroid([xy(p) for p in next(e for e in extra if 'Royal and Ancient' in e['tags'].get('name', ''))['geometry']])[1]
hotel = area_centroid([xy(p) for p in next(e for e in extra if e['tags'].get('name') == 'Old Course Hotel')['geometry']])[1]
# 石橋：第 18 洞中心線與小溪的交點
def cross(a, b, c, d):
    den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
    if abs(den) < 1e-9: return None
    t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den
    u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) if 0 <= t <= 1 and 0 <= u <= 1 else None
bridge = None
for bl in burn:
    for i in range(len(bl) - 1):
        for j in range(len(lines[17]) - 1):
            bridge = bridge or cross(lines[17][j], lines[17][j + 1], bl[i], bl[i + 1])

def bunker_circles(r, a, c):  # 多邊形 → 一個或數個圓（細長的沙坑沿長軸拆開）
    rad = math.sqrt(a / math.pi)
    sxx = sum((p[0] - c[0]) ** 2 for p in r); syy = sum((p[1] - c[1]) ** 2 for p in r); sxy = sum((p[0] - c[0]) * (p[1] - c[1]) for p in r)
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy); ax = (math.cos(ang), math.sin(ang))
    proj = [(p[0] - c[0]) * ax[0] + (p[1] - c[1]) * ax[1] for p in r]; half = (max(proj) - min(proj)) / 2
    if half < rad * 1.7: return [(c[0], c[1], rad)]
    n = min(4, max(2, round(half / rad)))
    w = a / (2 * half) / 2 * 1.15; mid = (max(proj) + min(proj)) / 2
    return [(c[0] + ax[0] * (mid + (k / (n - 1) - 0.5) * 2 * (half - w)), c[1] + ax[1] * (mid + (k / (n - 1) - 0.5) * 2 * (half - w)), w) for k in range(n)]

out = []
for hi, (h, line) in enumerate(zip(holes, lines)):
    tee, pin = line[0], line[-1]
    L = math.dist(tee, pin); d = ((pin[0] - tee[0]) / L, (pin[1] - tee[1]) / L); left = (-d[1], d[0])
    loc = lambda p: ((p[0] - tee[0]) * left[0] + (p[1] - tee[1]) * left[1], (p[0] - tee[0]) * d[0] + (p[1] - tee[1]) * d[1])  # (x 左, z 前)
    par = int(h['tags']['par'])
    length = sum(math.dist(line[i], line[i + 1]) for i in range(len(line) - 1))
    dog = max((loc(p)[0] for p in line[1:-1]), key=abs, default=0)
    # 果嶺半徑：包含旗桿（或最近）的果嶺面積；老球場多為兩洞共用的大果嶺，取一半
    g = min(greens, key=lambda g: 0 if inside(pin, g[0]) else math.dist(pin, g[2]))
    shared = sum(1 for l in lines if inside(l[-1], g[0]) or math.dist(l[-1], g[2]) < 12)
    green_r = max(11, min(19, math.sqrt(g[1] / max(1, shared) / math.pi)))
    # 球道寬度：沿中心線往兩側量球道輪廓
    ws = []
    for k in range(5, 18):
        t = k / 20; i = min(len(line) - 2, int(t * (len(line) - 1))); u = t * (len(line) - 1) - i
        p = (line[i][0] + (line[i + 1][0] - line[i][0]) * u, line[i][1] + (line[i + 1][1] - line[i][1]) * u)
        ext = 0
        for sd in (-1, 1):
            m = 0
            while m < 55 and any(inside((p[0] + left[0] * sd * (m + 1), p[1] + left[1] * sd * (m + 1)), f) for f in fairways): m += 1
            ext += m
        if ext: ws.append(ext)
    ws.sort(); width = 0 if par == 3 else max(30, min(46, ws[len(ws) // 2] if ws else 36))
    # 沙坑
    bs = []
    for r, a, c in bunkers:
        for (bx, by, br) in bunker_circles(r, a, c):
            x, z = loc((bx, by)); rr = max(2.6, min(8, br * 1.2))
            if z < 22 or z > L + 34 or abs(x - dog * 4 * (z / L) * (1 - z / L)) > 47: continue
            dp = math.hypot(x, z - L)
            if dp < green_r + rr + 0.6:  # 緊貼果嶺的沙坑推到果嶺邊緣外
                k = (green_r + rr + 0.6) / max(dp, 0.1); x, z = x * k, L + (z - L) * k
            bs.append([round(x, 1), round(z, 1), round(rr, 1)])
    # 小溪（Swilcan Burn）：沿溪每 2 m 放一個小水圓
    ws2 = []
    for bl in burn:
        acc = 0
        for i in range(len(bl) - 1):
            seg = math.dist(bl[i], bl[i + 1]); n = max(1, int(seg / 2.0))
            for k in range(n):
                p = (bl[i][0] + (bl[i + 1][0] - bl[i][0]) * k / n, bl[i][1] + (bl[i + 1][1] - bl[i][1]) * k / n)
                x, z = loc(p)
                if 14 < z < L + 30 and abs(x) < 50 and math.hypot(x, z - L) > green_r + 4: ws2.append([round(x, 1), round(z, 1), 1.6])
    tx, tz = loc(town); hx, hz = loc(hotel)
    item = {'name': h['tags'].get('name', ''), 'par': par, 'len': round(length), 'dog': round(dog, 1), 'pinX': 0, 'width': width, 'greenR': round(green_r, 1),
            'bunkers': bs, 'water': ws2, 'town': [round(tx), round(tz)], 'hotel': [round(hx), round(hz)]}
    if bridge:
        bx, bz = loc(bridge)
        if 0 < bz < L and abs(bx) < 50: item['bridge'] = [round(bx, 1), round(bz, 1)]
    out.append(item)

# —— 全場總覽圖：把整座球場轉正（長軸朝上），輸出簡化後的輪廓 ——
pts = [p for l in lines for p in l]
mx = sum(p[0] for p in pts) / len(pts); my = sum(p[1] for p in pts) / len(pts)
sxx = sum((p[0] - mx) ** 2 for p in pts); syy = sum((p[1] - my) ** 2 for p in pts); sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
ang = 0.5 * math.atan2(2 * sxy, sxx - syy); rot = math.pi / 2 - ang  # 轉到長軸朝上
if (lines[8][-1][0] - lines[0][0][0]) * math.cos(rot) * 0 + ((lines[8][-1][0] - mx) * math.sin(rot) + (lines[8][-1][1] - my) * math.cos(rot)) < 0: rot += math.pi  # 讓第 9 洞在上方（去程往上）
def ov(p):
    x, y = p[0] - mx, p[1] - my
    return (round(x * math.cos(rot) - y * math.sin(rot), 1), round(x * math.sin(rot) + y * math.cos(rot), 1))
flat = lambda r: [v for p in r for v in ov(p)]
overview = {
    'fairways': [flat(simp_ring(r, 2.5)) for r in fairways],
    'greens': [flat(simp_ring(r, 1.5)) for r, a, c in greens],
    'bunkers': [[*ov(c), round(math.sqrt(a / math.pi), 1)] for r, a, c in bunkers],
    'burn': [flat(simplify(b, 1.5)) for b in burn],
    'holes': [flat(l) for l in lines],
    'town': list(ov(town)), 'hotel': list(ov(hotel)),
    'north': round(math.degrees(rot), 1),  # 正北相對於圖面上方順時針轉了幾度
}
dst = os.path.join(HERE, '..', '..', 'src', 'game', 'links_data.js')
with open(dst, 'w') as f:
    f.write('// 由 tools/osm/build_links.py 產生，請勿手改。地圖資料 © OpenStreetMap contributors（ODbL）\n')
    f.write('// 每洞座標：發球台為原點，z 朝果嶺、x 朝左（公尺）。bunkers / water 為 [x, z, 半徑]\n')
    f.write('export const LINKS_HOLES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('export const LINKS_OVERVIEW = ' + json.dumps(overview, separators=(',', ':')) + ';\n')
print('holes', len(out), 'size', os.path.getsize(dst))
for i, o in enumerate(out): print(i + 1, o['name'], 'par', o['par'], 'len', o['len'], 'dog', o['dog'], 'w', o['width'], 'gR', o['greenR'], 'bunkers', len(o['bunkers']), 'water', len(o['water']), 'town', o['town'], o.get('bridge'))
print('total par', sum(o['par'] for o in out), 'fairways', len(fairways), 'greens', len(greens), 'bunkers', len(bunkers), 'bridge', bridge)
