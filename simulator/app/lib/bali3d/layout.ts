import type { DetectedBuilding, Segmentation, Vec2 } from "./segmentation";
import { BUILDING_SPECS, type BuildingSpec, totalHeight } from "./specs";

export interface PlacedBuilding {
  id: string;
  type: DetectedBuilding["type"];
  spec: BuildingSpec;
  center: Vec2;
  /** rotasi sumbu-y three.js: lokal +z (depan) -> arah `front` */
  phi: number;
  front: Vec2;
  right: Vec2;
  /** garis atap (dari denah) */
  W: number;
  D: number;
  /** badan bangunan / bebaturan */
  bodyW: number;
  bodyD: number;
  roofCorners: Vec2[];
  bodyCorners: Vec2[];
  /** titik keluar di depan pintu (untuk jalur evakuasi) */
  door: Vec2;
  height: number;
}

export type SpecOverrides = Record<string, Partial<BuildingSpec>>;

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.z * b.z;
const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s });

export function localToWorld(b: Pick<PlacedBuilding, "center" | "front" | "right">, lx: number, lz: number): Vec2 {
  return { x: b.center.x + b.right.x * lx + b.front.x * lz, z: b.center.z + b.right.z * lx + b.front.z * lz };
}

function rectCorners(b: Pick<PlacedBuilding, "center" | "front" | "right">, w: number, d: number): Vec2[] {
  return [
    localToWorld(b, -w / 2, -d / 2),
    localToWorld(b, w / 2, -d / 2),
    localToWorld(b, w / 2, d / 2),
    localToWorld(b, -w / 2, d / 2),
  ];
}

/** Pusat natah: rata-rata pusat bale utama; kalau tidak ada, titik berat lahan (0,0) */
export function natahCenter(seg: Segmentation): Vec2 {
  const main = seg.buildings.filter((b) =>
    ["bale_daja", "bale_dangin", "bale_dauh", "bale_delod"].includes(b.type)
  );
  if (main.length < 2) return { x: 0, z: 0 };
  const s = main.reduce((acc, b) => ({ x: acc.x + b.center.x, z: acc.z + b.center.z }), { x: 0, z: 0 });
  return scale(s, 1 / main.length);
}

export function placeBuildings(seg: Segmentation, overrides: SpecOverrides = {}): PlacedBuilding[] {
  const natah = natahCenter(seg);
  return seg.buildings.map((b) => {
    const spec: BuildingSpec = { ...BUILDING_SPECS[b.type], ...(overrides[b.id] ?? {}) };
    const d = sub(natah, b.center);
    const pu = dot(d, b.axisU);
    const pv = dot(d, b.axisV);
    let front: Vec2;
    let W: number;
    let D: number;
    if (Math.hypot(pu, pv) < 0.3) {
      front = { x: 0, z: 1 };
      W = b.lenU;
      D = b.lenV;
    } else if (Math.abs(pv) >= 0.5 * Math.abs(pu)) {
      front = scale(b.axisV, Math.sign(pv) || 1);
      W = b.lenU;
      D = b.lenV;
    } else {
      front = scale(b.axisU, Math.sign(pu) || 1);
      W = b.lenV;
      D = b.lenU;
    }
    // angkul-angkul menghadap ke luar (jalan)
    if (b.type === "angkul_angkul") front = scale(front, -1);
    const right: Vec2 = { x: front.z, z: -front.x };
    const phi = Math.atan2(front.x, front.z);

    const isShrine = spec.roofType === "pelinggih" || spec.roofType === "gate";
    const bodyW = isShrine ? W * 0.85 : Math.max(W - 2 * spec.overhang, W * 0.6);
    const bodyD = isShrine ? D * 0.85 : Math.max(D - 2 * spec.overhang, D * 0.6);
    const frame = { center: b.center, front, right };
    const door = localToWorld(frame, 0, (b.type === "angkul_angkul" ? -1 : 1) * (bodyD / 2 + 0.7));

    return {
      id: b.id,
      type: b.type,
      spec,
      center: b.center,
      phi,
      front,
      right,
      W,
      D,
      bodyW,
      bodyD,
      roofCorners: rectCorners(frame, W, D),
      bodyCorners: rectCorners(frame, bodyW, bodyD),
      door,
      height: totalHeight(spec, W, D),
    };
  });
}

/** jarak titik ke persegi panjang (0 bila di dalam) */
export function distPointToRect(p: Vec2, b: PlacedBuilding, w: number, d: number) {
  const rel = sub(p, b.center);
  const lx = Math.abs(dot(rel, b.right)) - w / 2;
  const lz = Math.abs(dot(rel, b.front)) - d / 2;
  const ox = Math.max(lx, 0);
  const oz = Math.max(lz, 0);
  return Math.hypot(ox, oz);
}

export function pointInPolygon(p: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** jarak bersih minimum antara dua persegi panjang berotasi (pendekatan sampling tepi) */
export function rectClearance(a: Vec2[], b: Vec2[]): number {
  const segDist = (p: Vec2, s0: Vec2, s1: Vec2) => {
    const v = sub(s1, s0);
    const t = Math.max(0, Math.min(1, dot(sub(p, s0), v) / (dot(v, v) || 1)));
    return Math.hypot(p.x - (s0.x + v.x * t), p.z - (s0.z + v.z * t));
  };
  if (a.some((p) => pointInPolygon(p, b)) || b.some((p) => pointInPolygon(p, a))) return 0;
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      best = Math.min(best, segDist(a[i], b[j], b[(j + 1) % 4]), segDist(b[j], a[i], a[(i + 1) % 4]));
    }
  }
  return best;
}
