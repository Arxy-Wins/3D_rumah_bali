/**
 * Tata letak berbasis aturan Asta Kosala Kosali (tanpa GAN) dan cek kesesuaian
 * jarak untuk tata letak apa pun (GAN maupun aturan).
 *
 * Koordinat lokal penyusunan: u = jarak ke arah kangin (timur) dari tembok kauh,
 * v = jarak ke arah kaja dari tembok kelod. Kaja = utara untuk Bali Selatan,
 * selatan untuk Bali Utara (pola sama dengan gambar tataUtara vs tataUtaraBU di API).
 */
import type { BuildingType, DetectedBuilding, Segmentation, Vec2 } from "./segmentation";
import { distPointToRect, type PlacedBuilding, pointInPolygon, rectClearance } from "./layout";
import {
  type AstaParams,
  DISTANCE_RULES,
  GATE_OUTWARD,
  gateSegments,
  gateSegmentT,
  getTier,
  kajaDir,
  ruleDistances,
  type Tier,
} from "./asta-rules";

type Rect = { u0: number; u1: number; v0: number; v1: number };

const WALL = 0.3;

/** ukuran garis atap default (m): [arah timur-barat, arah kaja-kelod] */
export const DEFAULT_SIZE: Record<BuildingType, [number, number]> = {
  bale_daja: [6.0, 3.6],
  bale_dangin: [3.4, 5.0],
  bale_dauh: [3.4, 5.0],
  bale_delod: [5.0, 3.2],
  paon: [3.6, 3.0],
  jineng: [2.6, 2.6],
  merajan: [4.5, 4.5],
  penunggun_karang: [1.2, 1.2],
  angkul_angkul: [2.4, 1.1],
};

/** bangunan memanjang ke arah mana: "u" (timur-barat) atau "v" (kaja-kelod) */
const LONG_AXIS: Partial<Record<BuildingType, "u" | "v">> = {
  bale_daja: "u",
  bale_delod: "u",
  paon: "u",
  bale_dangin: "v",
  bale_dauh: "v",
};

/** sisi lahan: lebar = sisi yang menghadap jalan (sisi gerbang) */
export function landExtents(p: AstaParams) {
  const NS = p.gateDirection === "Utara" || p.gateDirection === "Selatan";
  return NS ? { ew: p.landWidth, ns: p.landLength } : { ew: p.landLength, ns: p.landWidth };
}

function sizeOf(type: BuildingType, from: Segmentation | null, sf: number): [number, number] {
  const b = from?.buildings.find((x) => x.type === type);
  if (b) {
    const long = Math.max(b.lenU, b.lenV);
    const short = Math.min(b.lenU, b.lenV);
    return LONG_AXIS[type] === "v" ? [short, long] : [long, short];
  }
  const [a, c] = DEFAULT_SIZE[type];
  return [a * sf, c * sf];
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const vGapForCorner = (target: number, gx: number) => (gx < target ? Math.sqrt(target * target - gx * gx) : 0);

/** geser persegi supaya masuk lahan (tanpa mengubah ukuran) */
function fit(r: Rect, ew: number, ns: number): Rect {
  const w = r.u1 - r.u0;
  const h = r.v1 - r.v0;
  const u0 = clamp(r.u0, WALL, Math.max(WALL, ew - WALL - w));
  const v0 = clamp(r.v0, WALL, Math.max(WALL, ns - WALL - h));
  return { u0, u1: u0 + w, v0, v1: v0 + h };
}

function constructAndSolve(
  p: AstaParams,
  sizesFrom: Segmentation | null,
  gateSegment: number,
  ew: number,
  ns: number,
  d: Record<string, number>,
  sf: number,
  ms: number,
  poly: Vec2[] | null
): Partial<Record<BuildingType, Rect>> {
  const S = (t: BuildingType): [number, number] => {
    const [a, b] = sizeOf(t, sizesFrom, sf);
    const k = UTAMA.has(t) ? 1 : ms;
    return [a * k, b * k];
  };
  const rects: Partial<Record<BuildingType, Rect>> = {};

  // 1. merajan di sudut kaja-kangin (utama-utama)
  const [mu, mv] = S("merajan");
  rects.merajan = { u0: ew - WALL - mu, u1: ew - WALL, v0: ns - WALL - mv, v1: ns - WALL };

  // 2. bale daja: Uma ke tembok kaja, Guru ke merajan
  const [du, dv] = S("bale_daja");
  const dajaU1 = rects.merajan.u0 - d.guru;
  const daja = fit({ u0: dajaU1 - du, u1: dajaU1, v0: ns - d.uma - dv, v1: ns - d.uma }, ew, ns);
  rects.bale_daja = daja;

  // 3. bale dauh & dangin: Sri (kauh–kangin), dipusatkan; tinggi dari Kala & Indra (sudut ke sudut)
  const [wu, wv] = S("bale_dauh");
  const [eu, ev] = S("bale_dangin");
  const total = wu + d["sri-kauh-kangin"] + eu;
  let left = Math.max(WALL, (ew - total) / 2);
  if (left + total > ew - WALL) left = Math.max(WALL, ew - WALL - total);
  const dauhU0 = left;
  const danginU0 = left + wu + d["sri-kauh-kangin"];
  const gxE = Math.max(0, danginU0 - daja.u1);
  const danginV1 = daja.v0 - vGapForCorner(d.indra, gxE);
  rects.bale_dangin = fit({ u0: danginU0, u1: danginU0 + eu, v0: danginV1 - ev, v1: danginV1 }, ew, ns);
  const gxW = Math.max(0, daja.u0 - (dauhU0 + wu));
  const dauhV1 = daja.v0 - vGapForCorner(d["kala-dauh"], gxW);
  rects.bale_dauh = fit({ u0: dauhU0, u1: dauhU0 + wu, v0: dauhV1 - wv, v1: dauhV1 }, ew, ns);

  // 4. bale delod: Rudra di bawah bale daja
  const [lu, lv] = S("bale_delod");
  const dajaC = (daja.u0 + daja.u1) / 2;
  const delodV1 = daja.v0 - d.rudra;
  rects.bale_delod = fit({ u0: dajaC - lu / 2, u1: dajaC + lu / 2, v0: delodV1 - lv, v1: delodV1 }, ew, ns);

  // 5. paon (dapur): Brahma dari bale daja, di sisi kauh bale delod (nista)
  const [pu, pv] = S("paon");
  const paonU1 = Math.max(WALL + pu, rects.bale_delod.u0 - 0.6);
  const gxP = Math.max(0, daja.u0 - paonU1);
  const paonV1 = daja.v0 - vGapForCorner(d.brahma, gxP);
  rects.paon = fit({ u0: paonU1 - pu, u1: paonU1, v0: paonV1 - pv, v1: paonV1 }, ew, ns);

  // 6. jineng: Sri dari bale daja, di sisi kauh paon
  const [ju, jv] = S("jineng");
  const jinU1 = Math.max(WALL + ju, rects.paon.u0 - 0.5);
  const gxJ = Math.max(0, daja.u0 - jinU1);
  const jinV1 = daja.v0 - vGapForCorner(d["sri-jineng"], gxJ);
  rects.jineng = fit({ u0: jinU1 - ju, u1: jinU1, v0: jinV1 - jv, v1: jinV1 }, ew, ns);

  // 7. penunggun karang: Kala dari sudut kaja-kauh (diagonal)
  const [ku, kv] = S("penunggun_karang");
  const off = d["kala-penunggun"] / Math.SQRT2;
  rects.penunggun_karang = fit({ u0: off, u1: off + ku, v0: ns - off - kv, v1: ns - off }, ew, ns);

  // lahan tidak persegi (digambar): geser bangunan zona utama secukupnya agar masuk lahan
  if (poly) {
    UTAMA.forEach((t) => {
      if (rects[t]) rects[t] = nudgeInside(rects[t]!, poly, ew, ns);
    });
  }

  // ---- 8. optimasi: hilangkan tumpang tindih & dekatkan semua jarak ke aturan
  const solved = optimizeLayout(rects as Record<BuildingType, Rect>, d, ew, ns, gateKeepout(p, gateSegment, ew, ns), poly);
  (Object.keys(solved) as BuildingType[]).forEach((t) => (rects[t] = solved[t]));
  return rects;
}

const UTAMA = new Set<BuildingType>(["merajan", "bale_daja", "penunggun_karang"]);

/** koordinat lokal (u,v) — x = u (timur), y = v (kaja) */
const corners = (r: Rect): Vec2[] => [
  { x: r.u0, z: r.v0 },
  { x: r.u1, z: r.v0 },
  { x: r.u1, z: r.v1 },
  { x: r.u0, z: r.v1 },
];
function outsideCount(r: Rect, poly: Vec2[]) {
  // titik sudut + tengah sisi, dengan sedikit inset agar tembok tidak ikut dihitung
  const e = 0.15;
  const cu = (r.u0 + r.u1) / 2;
  const cv = (r.v0 + r.v1) / 2;
  const pts = [
    ...corners({ u0: r.u0 + e, u1: r.u1 - e, v0: r.v0 + e, v1: r.v1 - e }),
    { x: cu, z: r.v0 + e },
    { x: cu, z: r.v1 - e },
    { x: r.u0 + e, z: cv },
    { x: r.u1 - e, z: cv },
  ];
  // pojok lahan yang menjorok ke dalam bangunan (lahan bentuk L, dsb.)
  const inner = poly.filter((q) => q.x > r.u0 + e && q.x < r.u1 - e && q.z > r.v0 + e && q.z < r.v1 - e).length;
  return pts.filter((q) => !pointInPolygon(q, poly)).length + inner * 2;
}
function nudgeInside(r: Rect, poly: Vec2[], ew: number, ns: number): Rect {
  if (outsideCount(r, poly) === 0) return r;
  let best = r;
  let bestScore = Infinity;
  const R = Math.max(4, Math.ceil(Math.max(ew, ns) / 2));
  for (let du = -R; du <= R + 0.001; du += 0.25) {
    for (let dv = -R; dv <= R + 0.001; dv += 0.25) {
      const c = fit({ u0: r.u0 + du, u1: r.u1 + du, v0: r.v0 + dv, v1: r.v1 + dv }, ew, ns);
      const score = outsideCount(c, poly) * 100 + Math.hypot(c.u0 - r.u0, c.v0 - r.v0);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
  }
  return best;
}

export type LandShape = Vec2[]; // titik bebas (x = timur, z = selatan), mis. piksel gambar lahan

export function buildAstaSegmentation(
  p: AstaParams,
  sizesFrom: Segmentation | null,
  gateSegment: number,
  shape?: LandShape | null
): Segmentation {
  let { ew, ns } = landExtents(p);
  const s = kajaDir(p.orientation).z; // -1: kaja ke utara (-z)
  // bentuk lahan yang digambar: diskalakan ke ukuran form (sisi terpanjang = ukuran terbesar)
  let landWorld: Vec2[] | null = null;
  let poly: Vec2[] | null = null;
  if (shape && shape.length >= 3) {
    const xs = shape.map((q) => q.x);
    const zs = shape.map((q) => q.z);
    const bw = Math.max(...xs) - Math.min(...xs) || 1;
    const bh = Math.max(...zs) - Math.min(...zs) || 1;
    const big = Math.max(p.landLength, p.landWidth);
    const small = Math.min(p.landLength, p.landWidth);
    ew = bw >= bh ? big : small;
    ns = bw >= bh ? small : big;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cz = (Math.max(...zs) + Math.min(...zs)) / 2;
    landWorld = shape.map((q) => ({ x: ((q.x - cx) * ew) / bw, z: ((q.z - cz) * ns) / bh }));
    poly = landWorld.map((q) => ({ x: q.x + ew / 2, z: s < 0 ? ns / 2 - q.z : q.z + ns / 2 }));
  }
  const d = ruleDistances(p);
  const sf = clamp(Math.min(ew, ns) / 13, 0.45, 1);
  const notes: string[] = [];
  let rects: Partial<Record<BuildingType, Rect>> = {};
  for (const ms of [1, 0.88, 0.77, 0.68, 0.6]) {
    rects = constructAndSolve(p, sizesFrom, gateSegment, ew, ns, d, sf, ms, poly);
    const list = Object.values(rects) as Rect[];
    let worst = Infinity;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) worst = Math.min(worst, clearance(list[i], list[j]));
    if (worst >= 0.3) {
      if (ms < 1) notes.push(`Bangunan selain zona utama diperkecil ${Math.round((1 - ms) * 100)}% supaya muat di lahan.`);
      break;
    }
    if (ms === 0.6) notes.push("Lahan terlalu sempit: masih ada bangunan yang berdempetan walau sudah diperkecil 40%.");
  }

  // ---- ke koordinat dunia
  const toWorld = (u: number, v: number): Vec2 => ({ x: u - ew / 2, z: s * (v - ns / 2) });
  const buildings: DetectedBuilding[] = (Object.entries(rects) as [BuildingType, Rect][]).map(([type, r]) => {
    const c = toWorld((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2);
    const lenU = r.u1 - r.u0;
    const lenV = r.v1 - r.v0;
    return {
      id: `${type}-0`,
      type,
      center: c,
      axisU: { x: 1, z: 0 },
      axisV: { x: 0, z: 1 },
      lenU,
      lenV,
      areaM2: lenU * lenV,
      pixelCount: 0,
    };
  });

  const land: Vec2[] = landWorld ?? [
    { x: -ew / 2, z: -ns / 2 },
    { x: ew / 2, z: -ns / 2 },
    { x: ew / 2, z: ns / 2 },
    { x: -ew / 2, z: ns / 2 },
  ];
  if (landWorld) notes.unshift(`Mengikuti bentuk lahan (kotak luar ${ew.toFixed(1)} × ${ns.toFixed(1)} m, luas ${polygonAreaLocal(landWorld).toFixed(1)} m²).`);
  const area = landWorld ? polygonAreaLocal(landWorld) : ew * ns;
  const seg: Segmentation = { metersPerPixel: 0, land, landAreaM2: area, buildings, width: 0, height: 0, notes };
  return withGate(seg, p, gateSegment, true);
}

/**
 * Tambahkan/atur angkul-angkul di sisi gerbang pada segmen yang dipilih.
 * replace=false: hanya ditambahkan bila denah (GAN) tidak punya angkul-angkul.
 */
export function withGate(seg: Segmentation, p: AstaParams, gateSegment: number, replace = false): Segmentation {
  const has = seg.buildings.some((b) => b.type === "angkul_angkul");
  if (has && !replace) return seg;
  if (seg.land.length < 3) return seg;
  const xs = seg.land.map((q) => q.x);
  const zs = seg.land.map((q) => q.z);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minZ = Math.min(...zs);
  let maxZ = Math.max(...zs);
  const { axis, t } = gateSegmentT(p.gateDirection, gateSegment);
  const out = GATE_OUTWARD[p.gateDirection];
  // lahan tidak kotak: pakai rentang sisi depan yang sebenarnya (API: sisi depan ÷ 9)
  {
    const front = axis === "x"
      ? seg.land.filter((q) => Math.abs(q.z - (out.z < 0 ? minZ : maxZ)) < 0.05)
      : seg.land.filter((q) => Math.abs(q.x - (out.x > 0 ? maxX : minX)) < 0.05);
    if (front.length >= 2) {
      const vals = front.map((q) => (axis === "x" ? q.x : q.z));
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      if (hi - lo > 1) {
        if (axis === "x") { minX = lo; maxX = hi; } else { minZ = lo; maxZ = hi; }
      }
    }
  }
  const sideLen = axis === "x" ? maxX - minX : maxZ - minZ;
  const along = clamp(sideLen / 9, 1.2, 3.0);
  const depth = 1.1;
  let center: Vec2;
  if (axis === "x") {
    const x = minX + t * (maxX - minX);
    center = { x, z: out.z < 0 ? edgeZAt(seg.land, x, "min") : edgeZAt(seg.land, x, "max") };
  } else {
    const z = minZ + t * (maxZ - minZ);
    center = { x: out.x > 0 ? edgeXAt(seg.land, z, "max") : edgeXAt(seg.land, z, "min"), z };
  }
  const gate: DetectedBuilding = {
    id: "angkul_angkul-0",
    type: "angkul_angkul",
    center,
    axisU: { x: 1, z: 0 },
    axisV: { x: 0, z: 1 },
    lenU: axis === "x" ? along : depth,
    lenV: axis === "x" ? depth : along,
    areaM2: along * depth,
    pixelCount: 0,
  };
  return { ...seg, buildings: [...seg.buildings.filter((b) => b.type !== "angkul_angkul"), gate] };
}

/** titik potong garis vertikal x dengan tepi poligon, ambil z min/max */
function edgeZAt(poly: Vec2[], x: number, which: "min" | "max") {
  const hits: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) hits.push(a.z + ((x - a.x) / (b.x - a.x)) * (b.z - a.z));
  }
  if (!hits.length) return which === "min" ? Math.min(...poly.map((q) => q.z)) : Math.max(...poly.map((q) => q.z));
  return which === "min" ? Math.min(...hits) : Math.max(...hits);
}
function edgeXAt(poly: Vec2[], z: number, which: "min" | "max") {
  const hits: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((a.z - z) * (b.z - z) <= 0 && a.z !== b.z) hits.push(a.x + ((z - a.z) / (b.z - a.z)) * (b.x - a.x));
  }
  if (!hits.length) return which === "min" ? Math.min(...poly.map((q) => q.x)) : Math.max(...poly.map((q) => q.x));
  return which === "min" ? Math.min(...hits) : Math.max(...hits);
}

// ---------------- optimasi tata letak ----------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** jarak bersih dua persegi sejajar sumbu; negatif = tumpang tindih (kedalaman) */
function clearance(a: Rect, b: Rect) {
  const dx = Math.max(a.u0 - b.u1, b.u0 - a.u1);
  const dy = Math.max(a.v0 - b.v1, b.v0 - a.v1);
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
  if (dx > 0) return dx;
  if (dy > 0) return dy;
  return Math.max(dx, dy); // ≤ 0
}

/** area bebas di depan gerbang (dalam lahan) supaya tidak tertutup bangunan */
function gateKeepout(p: AstaParams, k: number, ew: number, ns: number): Rect {
  const { axis, t } = gateSegmentT(p.gateDirection, k);
  const kaja = kajaDir(p.orientation).z; // -1: kaja = utara
  const w = clamp((axis === "x" ? ew : ns) / 9, 1.2, 3.0) + 0.4;
  const depth = 2.0;
  if (axis === "x") {
    const u = t * ew;
    // sisi utara/selatan → v=ns (kaja) atau v=0 (kelod) tergantung orientasi
    const atNorth = p.gateDirection === "Utara";
    const atKaja = (atNorth && kaja < 0) || (!atNorth && kaja > 0);
    return atKaja
      ? { u0: u - w / 2, u1: u + w / 2, v0: ns - depth, v1: ns }
      : { u0: u - w / 2, u1: u + w / 2, v0: 0, v1: depth };
  }
  // sisi timur/barat; t dihitung dari utara
  const fromNorth = t * ns;
  const v = kaja < 0 ? ns - fromNorth : fromNorth;
  return p.gateDirection === "Timur"
    ? { u0: ew - depth, u1: ew, v0: v - w / 2, v1: v + w / 2 }
    : { u0: 0, u1: depth, v0: v - w / 2, v1: v + w / 2 };
}

const MIN_GAP = 0.8; // jarak bersih minimum antar atap (lorong)

function polygonAreaLocal(poly: Vec2[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

function optimizeLayout(
  init: Record<BuildingType, Rect>,
  d: Record<string, number>,
  ew: number,
  ns: number,
  keepout: Rect,
  poly: Vec2[] | null
): Record<BuildingType, Rect> {
  const types = (Object.keys(init) as BuildingType[]).filter((t) => t !== "angkul_angkul");
  // zona utama (merajan, bale daja, penunggun karang) dikunci di posisi aturan (Uma, Guru, Kala);
  // bangunan lain disusun mengikuti bale daja
  const movable = types.filter((t) => !UTAMA.has(t));
  const cur: Record<string, Rect> = {};
  types.forEach((t) => (cur[t] = { ...init[t] }));
  const anchor: Record<string, { u: number; v: number }> = {};
  types.forEach((t) => (anchor[t] = { u: (init[t].u0 + init[t].u1) / 2, v: (init[t].v0 + init[t].v1) / 2 }));

  // natah (halaman tengah) harus tetap terbuka
  const daja0 = init.bale_daja;
  // natah = ruang di antara bale daja dan bale delod (jarak Rudra), bagian tengah lahan
  const natah: Rect | null =
    daja0 && d.rudra > 1.8
      ? { u0: ew * 0.33, u1: ew * 0.67, v0: daja0.v0 - d.rudra + 0.8, v1: daja0.v0 - 0.8 }
      : null;
  const pair = (a: BuildingType, b: BuildingType) => (cur[a] && cur[b] ? clearance(cur[a], cur[b]) : null);
  const ruleTerms: [string, () => number | null][] = [
    ["guru", () => pair("merajan", "bale_daja")],
    ["rudra", () => pair("bale_daja", "bale_delod")],
    ["sri-kauh-kangin", () => pair("bale_dauh", "bale_dangin")],
    ["brahma", () => pair("bale_daja", "paon")],
    ["sri-jineng", () => pair("bale_daja", "jineng")],
    ["kala-dauh", () => pair("bale_dauh", "bale_daja")],
    ["uma", () => (cur.bale_daja ? ns - cur.bale_daja.v1 : null)],
    ["kala-penunggun", () => (cur.penunggun_karang ? Math.hypot(cur.penunggun_karang.u0, ns - cur.penunggun_karang.v1) : null)],
    ["indra", () => pair("bale_daja", "bale_dangin")],
  ];

  // prioritas: aturan zona utama/kaja dulu (Uma, Guru, Penunggun, Indra, Kala, Sri), lalu nista
  const W: Record<string, number> = {
    uma: 10,
    guru: 10,
    "kala-penunggun": 9,
    indra: 8,
    "kala-dauh": 8,
    "sri-kauh-kangin": 8,
    rudra: 6,
    brahma: 5,
    "sri-jineng": 4,
  };
  const cost = () => {
    let c = 0;
    for (const [id, f] of ruleTerms) {
      const a = f();
      if (a === null) continue;
      // L1 halus: mendorong sebanyak mungkin aturan terpenuhi persis
      const e = a - d[id];
      c += W[id] * Math.sqrt(e * e + 0.0025);
    }
    for (let i = 0; i < types.length; i++) {
      const A = cur[types[i]];
      for (let j = i + 1; j < types.length; j++) {
        const g = clearance(A, cur[types[j]]);
        if (g < MIN_GAP) c += 60 * (MIN_GAP - g) ** 2 + (g < 0 ? 200 * (MIN_GAP - g) : 0);
      }
      if (natah && !UTAMA.has(types[i])) {
        const gn = clearance(A, natah);
        if (gn < 0) c += 30 + 40 * -gn;
      }
      if (poly) {
        const out = outCache[types[i]];
        if (out) c += 80 * out;
      }
      const gk = clearance(A, keepout);
      if (gk < 0.3) c += 40 * (0.3 - gk) ** 2 + (gk < 0 ? 100 : 0);
      const an = anchor[types[i]];
      const cu = (A.u0 + A.u1) / 2;
      const cv = (A.v0 + A.v1) / 2;
      c += 0.04 * ((cu - an.u) ** 2 + (cv - an.v) ** 2);
    }
    return c;
  };

  // jumlah titik di luar lahan per bangunan (di-cache; hanya dihitung ulang untuk bangunan yang digeser)
  const outCache: Record<string, number> = {};
  const refreshOut = (t: string) => (outCache[t] = poly ? outsideCount(cur[t], poly) : 0);
  types.forEach(refreshOut);
  const snapshot = () => Object.fromEntries(types.map((t) => [t, { ...cur[t] }])) as Record<string, Rect>;
  const start = snapshot();
  let best = cost();
  let bestState = start;
  for (const seed of [1337, 7]) {
  const rnd = mulberry32(seed);
  types.forEach((t) => (cur[t] = { ...start[t] }));
  types.forEach(refreshOut);
  let curCost = cost();
  const N = 6000;
  for (let it = 0; it < N; it++) {
    const T = 1 * Math.pow(0.0005, it / N);
    const t = movable[Math.floor(rnd() * movable.length)];
    const r = cur[t];
    const step = 0.15 + 1.2 * Math.sqrt(T);
    const du = (rnd() - 0.5) * 2 * step;
    const dv = (rnd() - 0.5) * 2 * step;
    const moved = fit({ u0: r.u0 + du, u1: r.u1 + du, v0: r.v0 + dv, v1: r.v1 + dv }, ew, ns);
    cur[t] = moved;
    const prevOut = outCache[t];
    refreshOut(t);
    const nc = cost();
    if (nc < curCost || rnd() < Math.exp((curCost - nc) / T)) {
      curCost = nc;
      if (nc < best) {
        best = nc;
        bestState = snapshot();
      }
    } else {
      cur[t] = r;
      outCache[t] = prevOut;
    }
  }
  }
  // pemolesan: turun-bukit deterministik dengan langkah mengecil, supaya jarak
  // yang memang bisa dipenuhi benar-benar pas (annealing saja sering berhenti "hampir")
  types.forEach((t) => (cur[t] = { ...bestState[t] }));
  types.forEach(refreshOut);
  let curBest = cost();
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  for (const step of [1, 0.5, 0.25, 0.1, 0.04, 0.02]) {
    for (let pass = 0; pass < 25; pass++) {
      let improved = false;
      for (const t of movable) {
        for (const [a, b] of dirs) {
          const r = cur[t];
          cur[t] = fit({ u0: r.u0 + a * step, u1: r.u1 + a * step, v0: r.v0 + b * step, v1: r.v1 + b * step }, ew, ns);
          const prevOut = outCache[t];
          refreshOut(t);
          const nc = cost();
          if (nc < curBest - 1e-6) {
            curBest = nc;
            improved = true;
          } else {
            cur[t] = r;
            outCache[t] = prevOut;
          }
        }
      }
      if (!improved) break;
    }
  }
  return snapshot() as Record<BuildingType, Rect>;
}

// ---------------- cek kesesuaian ----------------

export interface ComplianceRow {
  id: string;
  label: string;
  sideKey: string;
  target: number;
  actual: number | null;
  status: "sesuai" | "tidak" | "kosong";
}

export interface ComplianceReport {
  tier: Tier;
  rows: ComplianceRow[];
  okCount: number;
  gate: { segment: number; name: string; good: boolean; meaning: string };
}

function segDist(p: Vec2, a: Vec2, b: Vec2) {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const t = clamp(((p.x - a.x) * vx + (p.z - a.z) * vz) / (vx * vx + vz * vz || 1), 0, 1);
  return Math.hypot(p.x - (a.x + vx * t), p.z - (a.z + vz * t));
}

export function checkCompliance(
  buildings: PlacedBuilding[],
  land: Vec2[],
  p: AstaParams,
  gateSegment: number
): ComplianceReport {
  const tier = getTier(p.landLength, p.landWidth);
  const targets = ruleDistances(p);
  const k = kajaDir(p.orientation);
  const find = (t: BuildingType) => buildings.find((b) => b.type === t);
  const cx = land.reduce((a, q) => a + q.x, 0) / Math.max(land.length, 1);
  const cz = land.reduce((a, q) => a + q.z, 0) / Math.max(land.length, 1);

  const rows: ComplianceRow[] = DISTANCE_RULES.map((r) => {
    const target = targets[r.id];
    const a = find(r.a);
    let actual: number | null = null;
    if (a) {
      if (r.b === "tembok_kaja") {
        let best = Infinity;
        for (let i = 0; i < land.length; i++) {
          const e0 = land[i];
          const e1 = land[(i + 1) % land.length];
          const mx = (e0.x + e1.x) / 2 - cx;
          const mz = (e0.z + e1.z) / 2 - cz;
          // normal tepi yang menghadap keluar
          let nx = e1.z - e0.z;
          let nz = -(e1.x - e0.x);
          const nl = Math.hypot(nx, nz) || 1;
          nx /= nl;
          nz /= nl;
          if (nx * mx + nz * mz < 0) {
            nx = -nx;
            nz = -nz;
          }
          if (nx * k.x + nz * k.z < 0.7) continue;
          for (const c of a.roofCorners) best = Math.min(best, segDist(c, e0, e1));
        }
        actual = Number.isFinite(best) ? best : null;
      } else if (r.b === "sudut_kaja_kauh") {
        const dir = { x: k.x - 1, z: k.z }; // kaja + kauh(barat)
        let corner = land[0];
        for (const q of land) if (q.x * dir.x + q.z * dir.z > corner.x * dir.x + corner.z * dir.z) corner = q;
        actual = corner ? distPointToRect(corner, a, a.W, a.D) : null;
      } else {
        const b = find(r.b);
        if (b) actual = rectClearance(a.roofCorners, b.roofCorners);
      }
    }
    const tol = Math.max(0.25, 0.1 * target);
    return {
      id: r.id,
      label: r.label,
      sideKey: r.sideKey,
      target,
      actual,
      status: actual === null ? "kosong" : Math.abs(actual - target) <= tol ? "sesuai" : "tidak",
    };
  });

  const seg = gateSegments(p.gateDirection)[gateSegment - 1];
  return {
    tier,
    rows,
    okCount: rows.filter((r) => r.status === "sesuai").length,
    gate: { segment: gateSegment, name: seg.bhsBali, good: seg.good, meaning: seg.bhsIndonesia },
  };
}
