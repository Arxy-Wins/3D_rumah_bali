/**
 * Segmentasi gambar denah hasil GAN (256x256, kode warna per bangunan)
 * menjadi daftar bangunan + kontur lahan dalam satuan meter.
 *
 * Konvensi koordinat dunia (dipakai di 3D):
 *   x = timur (+) / barat (-)      -> sumbu x gambar
 *   z = selatan (+) / utara (-)    -> sumbu y gambar (y gambar ke bawah = selatan)
 *   y = atas
 * Titik (0,0) = titik berat lahan.
 *
 * Catatan penting: warna di denah adalah TAMPAK ATAS, jadi yang terlihat
 * adalah garis luar ATAP (termasuk teritisan), bukan badan bangunan.
 */

export type BuildingType =
  | "bale_daja"
  | "merajan"
  | "bale_dangin"
  | "bale_dauh"
  | "bale_delod"
  | "paon"
  | "jineng"
  | "penunggun_karang"
  | "angkul_angkul";

type PixelClass = BuildingType | "land" | "bg" | "utara";

export const PALETTE: { cls: PixelClass; name: string; rgb: [number, number, number] }[] = [
  { cls: "bg", name: "Latar", rgb: [255, 255, 255] },
  { cls: "land", name: "Lahan", rgb: [0, 0, 0] },
  { cls: "utara", name: "Utara", rgb: [0, 0, 255] },
  { cls: "bale_daja", name: "Bale Daja", rgb: [222, 170, 37] },
  { cls: "merajan", name: "Merajan", rgb: [255, 0, 0] },
  { cls: "bale_dangin", name: "Bale Dangin", rgb: [0, 133, 255] },
  { cls: "bale_dauh", name: "Bale Dauh", rgb: [14, 151, 28] },
  { cls: "bale_delod", name: "Bale Delod", rgb: [80, 1, 159] },
  { cls: "paon", name: "Paon", rgb: [255, 0, 168] },
  { cls: "jineng", name: "Jineng", rgb: [101, 32, 10] },
  { cls: "jineng", name: "Jineng", rgb: [254, 82, 6] },
  { cls: "penunggun_karang", name: "Penunggun Karang", rgb: [0, 255, 240] },
  { cls: "angkul_angkul", name: "Angkul-angkul", rgb: [217, 217, 217] },
];

const BUILDING_CLASSES = new Set<PixelClass>([
  "bale_daja",
  "merajan",
  "bale_dangin",
  "bale_dauh",
  "bale_delod",
  "paon",
  "jineng",
  "penunggun_karang",
  "angkul_angkul",
]);

export type Vec2 = { x: number; z: number };

export interface DetectedBuilding {
  id: string;
  type: BuildingType;
  /** pusat garis atap (meter, koordinat dunia) */
  center: Vec2;
  /** sumbu utama (vektor satuan) dan sumbu kedua */
  axisU: Vec2;
  axisV: Vec2;
  /** panjang garis atap di sepanjang axisU dan axisV (meter) */
  lenU: number;
  lenV: number;
  areaM2: number;
  pixelCount: number;
}

export interface Segmentation {
  metersPerPixel: number;
  land: Vec2[]; // poligon lahan (meter)
  landAreaM2: number;
  buildings: DetectedBuilding[];
  /** label kelas per piksel (indeks PALETTE), berguna untuk debug */
  width: number;
  height: number;
  /** catatan untuk pengguna (mis. ukuran bangunan diperkecil) */
  notes?: string[];
}

/** Skala sama dengan output.tsx: jarak_m = px / 2.08 * footLength / 100 */
export function metersPerPixelFromFootLength(footLengthCm: number) {
  return footLengthCm / 208;
}

const IDX_BG = 0;
const IDX_LAND = 1;
/** jarak warna maksimum (kuadrat) agar piksel dianggap bangunan; sisanya lahan/latar */
const MAX_BUILDING_D2 = 75 * 75;

function nearestClass(r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE.length; i++) {
    const [pr, pg, pb] = PALETTE[i].rgb;
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  // warna "nanggung" hasil GAN (mis. coklat gelap di tepi lahan) jangan jadi bangunan
  if (best > IDX_LAND && bestD > MAX_BUILDING_D2) return r + g + b < 380 ? IDX_LAND : IDX_BG;
  return best;
}

/** filter modus 3x3 untuk membersihkan bintik noise keluaran GAN */
function modeFilter(labels: Int16Array, w: number, h: number): Int16Array {
  const out = new Int16Array(labels.length);
  const counts = new Int16Array(PALETTE.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      counts.fill(0);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          counts[labels[ny * w + nx]]++;
        }
      }
      const self = labels[y * w + x];
      let best = self;
      for (let i = 0; i < counts.length; i++) {
        if (counts[i] > counts[best]) best = i;
      }
      out[y * w + x] = counts[self] >= 3 ? self : best;
    }
  }
  return out;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

/** Telusur kontur Moore pada mask biner, hasil dalam koordinat piksel */
function traceContour(mask: Uint8Array, w: number, h: number): [number, number][] {
  let start = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      start = i;
      break;
    }
  }
  if (start < 0) return [];
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  let cx = start % w;
  let cy = Math.floor(start / w);
  const sx = cx;
  const sy = cy;
  let dir = 0;
  const pts: [number, number][] = [[cx, cy]];
  for (let guard = 0; guard < w * h * 2; guard++) {
    const s = (dir + 6) % 8;
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const d = (s + k) % 8;
      if (inside(cx + dx[d], cy + dy[d])) {
        cx += dx[d];
        cy += dy[d];
        dir = d;
        moved = true;
        break;
      }
    }
    if (!moved) break;
    if (cx === sx && cy === sy) break;
    pts.push([cx, cy]);
  }
  return pts;
}

function rdp(points: [number, number][], eps: number): [number, number][] {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  let maxD = -1;
  let idx = 0;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > eps) {
    const left = rdp(points.slice(0, idx + 1), eps);
    const right = rdp(points.slice(idx), eps);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

function simplifyClosed(points: [number, number][], eps: number): [number, number][] {
  if (points.length < 4) return points;
  // pecah di titik terjauh dari titik awal supaya RDP stabil untuk kurva tertutup
  let far = 0;
  let farD = -1;
  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const a = rdp(points.slice(0, far + 1), eps);
  const b = rdp([...points.slice(far), points[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

export function polygonArea(poly: Vec2[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.z - b.x * a.z;
  }
  return Math.abs(s) / 2;
}

/** Sudut dominan lahan (rad): orientasi kotak pembatas luas minimum dari kontur */
function dominantAngle(poly: Vec2[], dense: Vec2[]): number {
  let best = 0;
  let bestArea = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-6) continue;
    const t = Math.atan2(b.z - a.z, b.x - a.x);
    const c = Math.cos(t);
    const s = Math.sin(t);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of dense) {
      const u = p.x * c + p.z * s;
      const v = -p.x * s + p.z * c;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u);
      v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area < bestArea) {
      bestArea = area;
      best = t;
    }
  }
  return best;
}

function snapAngle(theta: number, ref: number, tolRad: number) {
  const q = Math.PI / 2;
  const rel = theta - ref;
  const k = Math.round(rel / q);
  const diff = rel - k * q;
  return Math.abs(diff) <= tolRad ? ref + k * q : theta;
}

export function segmentPlan(imageData: ImageData, footLengthCm: number): Segmentation {
  const w = imageData.width;
  const h = imageData.height;
  const mpp = metersPerPixelFromFootLength(footLengthCm);
  const data = imageData.data;

  let labels = new Int16Array(w * h);
  for (let i = 0; i < w * h; i++) {
    labels[i] = nearestClass(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  labels = modeFilter(labels, w, h);

  // ---- lahan: semua piksel bukan latar & bukan penanda utara, ambil komponen terbesar
  const landMask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const cls = PALETTE[labels[i]].cls;
    landMask[i] = cls !== "bg" && cls !== "utara" ? 1 : 0;
  }
  const largest = largestComponent(landMask, w, h);
  let cxp = 0;
  let cyp = 0;
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (largest[i]) {
      cxp += i % w;
      cyp += Math.floor(i / w);
      n++;
    }
  }
  if (n === 0) {
    return { metersPerPixel: mpp, land: [], landAreaM2: 0, buildings: [], width: w, height: h };
  }
  cxp = cxp / n + 0.5;
  cyp = cyp / n + 0.5;
  const toWorld = (px: number, py: number): Vec2 => ({ x: (px - cxp) * mpp, z: (py - cyp) * mpp });

  const rawContour = traceContour(largest, w, h);
  const contour = simplifyClosed(rawContour, 1.2);
  const land = contour.map(([px, py]) => toWorld(px + 0.5, py + 0.5));
  // sisi poligon sederhana bisa sedikit miring akibat pikselasi; uji juga sudut
  // dari potongan kontur panjang (setiap ~12 piksel) agar orientasi lebih akurat
  const coarse = rawContour.filter((_, i) => i % 12 === 0).map(([px, py]) => toWorld(px + 0.5, py + 0.5));
  const refAngle = dominantAngle([...land, ...coarse], land);

  // ---- komponen terhubung per kelas bangunan
  const visited = new Uint8Array(w * h);
  const found: DetectedBuilding[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (visited[i]) continue;
    const cls = PALETTE[labels[i]].cls;
    if (!BUILDING_CLASSES.has(cls) || !largest[i]) {
      visited[i] = 1;
      continue;
    }
    const pixels: number[] = [];
    stack.push(i);
    visited[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      pixels.push(p);
      const x = p % w;
      const y = (p - x) / w;
      const nbs = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nbs) {
        if (q < 0 || visited[q]) continue;
        if (PALETTE[labels[q]].cls === cls) {
          visited[q] = 1;
          stack.push(q);
        }
      }
    }
    if (pixels.length < (cls === "penunggun_karang" ? 20 : 36)) continue;

    // PCA untuk orientasi
    let mx = 0;
    let my = 0;
    for (const p of pixels) {
      mx += (p % w) + 0.5;
      my += Math.floor(p / w) + 0.5;
    }
    mx /= pixels.length;
    my /= pixels.length;
    let cxx = 0;
    let cyy = 0;
    let cxy = 0;
    for (const p of pixels) {
      const dx = (p % w) + 0.5 - mx;
      const dy = Math.floor(p / w) + 0.5 - my;
      cxx += dx * dx;
      cyy += dy * dy;
      cxy += dx * dy;
    }
    const pca = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    // Kandidat sudut: hasil PCA dan sudut dominan lahan. Untuk blob hampir
    // persegi PCA tidak stabil, jadi pilih sudut dengan kotak pembatas terkecil
    // dan utamakan sejajar lahan bila selisih luasnya kecil.
    const extentsAt = (theta: number) => {
      const ux = Math.cos(theta);
      const uy = Math.sin(theta);
      const pu: number[] = [];
      const pv: number[] = [];
      for (const p of pixels) {
        const dx = (p % w) + 0.5 - mx;
        const dy = Math.floor(p / w) + 0.5 - my;
        pu.push(dx * ux + dy * uy);
        pv.push(-dx * uy + dy * ux);
      }
      pu.sort((a, b) => a - b);
      pv.sort((a, b) => a - b);
      const u0 = percentile(pu, 0.02);
      const u1 = percentile(pu, 0.98);
      const v0 = percentile(pv, 0.02);
      const v1 = percentile(pv, 0.98);
      return { theta, ux, uy, u0, u1, v0, v1, area: (u1 - u0 + 1) * (v1 - v0 + 1) };
    };
    const cand = [extentsAt(pca), extentsAt(snapAngle(pca, refAngle, Math.PI / 4))];
    const minArea = Math.min(cand[0].area, cand[1].area);
    const pick = cand[1].area <= minArea * 1.08 ? cand[1] : cand[0];
    const { ux, uy, u0, u1, v0, v1 } = pick;
    const midU = (u0 + u1) / 2;
    const midV = (v0 + v1) / 2;
    const cx = mx + midU * ux - midV * uy;
    const cy = my + midU * uy + midV * ux;

    found.push({
      id: `${cls}-${found.length}`,
      type: cls as BuildingType,
      center: toWorld(cx, cy),
      axisU: { x: ux, z: uy },
      axisV: { x: -uy, z: ux },
      lenU: (u1 - u0 + 1) * mpp,
      lenV: (v1 - v0 + 1) * mpp,
      areaM2: pixels.length * mpp * mpp,
      pixelCount: pixels.length,
    });
  }

  // GAN kadang memecah satu bangunan atau menyisakan bercak warna.
  // Bangunan tunggal (bale, paon, angkul-angkul) → ambil komponen terbesar saja;
  // jineng maksimal 2; merajan boleh beberapa (pelinggih terpisah).
  const buildings: DetectedBuilding[] = [];
  const byType = new Map<BuildingType, DetectedBuilding[]>();
  for (const b of found) {
    const arr = byType.get(b.type) ?? [];
    arr.push(b);
    byType.set(b.type, arr);
  }
  byType.forEach((arr, type) => {
    arr.sort((a, b) => b.pixelCount - a.pixelCount);
    const maxPx = arr[0].pixelCount;
    arr.forEach((b, idx) => {
      const keep =
        idx === 0 ||
        (type === "merajan" && b.pixelCount >= 0.25 * maxPx) ||
        (type === "jineng" && idx === 1 && b.pixelCount >= 0.5 * maxPx);
      if (keep) {
        buildings.push({ ...b, id: `${type}-${idx}` });
      }
    });
  });

  return {
    metersPerPixel: mpp,
    land,
    landAreaM2: polygonArea(land),
    buildings,
    width: w,
    height: h,
  };
}

function largestComponent(mask: Uint8Array, w: number, h: number): Uint8Array {
  const comp = new Int32Array(w * h).fill(-1);
  let bestId = -1;
  let bestSize = 0;
  let id = 0;
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || comp[i] >= 0) continue;
    let size = 0;
    stack.push(i);
    comp[i] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      const nbs = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nbs) {
        if (q >= 0 && mask[q] && comp[q] < 0) {
          comp[q] = id;
          stack.push(q);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
    id++;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = comp[i] === bestId ? 1 : 0;
  return out;
}
