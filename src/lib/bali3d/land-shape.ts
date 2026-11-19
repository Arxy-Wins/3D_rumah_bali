/**
 * BENTUK LAHAN DARI UKURAN LAPANGAN
 * Lahan nyata jarang persegi panjang sempurna. Pengguna mengisi ukuran yang biasa ada di
 * sertifikat / hasil ukur meteran, lalu diubah jadi poligon (meter).
 *
 * Sistem koordinat lokal: berdiri di jalan menghadap lahan.
 *   u = ke kanan sepanjang sisi depan (sisi jalan/gerbang), w = masuk ke dalam lahan.
 *   Sisi depan selalu tepi titik 0 → titik 1 (w = 0).
 * Lalu diputar ke dunia (x = timur, z = selatan) sesuai arah gerbang.
 */
import type { Vec2 } from "./segmentation";
import type { GateDirection } from "./asta-rules";

export type LandMode = "persegi" | "trapesium" | "ukur" | "L" | "titik";

export interface LandInput {
  mode: LandMode;
  /** persegi: depan × dalam */
  depan: number;
  dalam: number;
  /** trapesium */
  belakang: number;
  geser: number; // pergeseran sisi belakang ke kanan (m), 0 = rata kiri
  /** ukur 4 sisi + diagonal */
  kanan: number;
  kiri: number;
  diagonal: number; // pojok depan-kiri → pojok belakang-kanan
  /** bentuk L: potongan di pojok belakang */
  potongLebar: number;
  potongDalam: number;
  potongSisi: "kanan" | "kiri";
  /** titik bebas: "u,w" per baris (meter) */
  titik: string;
}

export const DEFAULT_LAND: LandInput = {
  mode: "persegi",
  depan: 14,
  dalam: 18,
  belakang: 11,
  geser: 1.5,
  kanan: 18.2,
  kiri: 18,
  diagonal: 22.5,
  potongLebar: 5,
  potongDalam: 6,
  potongSisi: "kanan",
  titik: "0,0\n14,0\n15,10\n12,18\n0,18",
};

export const LAND_MODE_LABEL: Record<LandMode, string> = {
  persegi: "Persegi panjang",
  trapesium: "Trapesium (depan ≠ belakang)",
  ukur: "Ukur 4 sisi + 1 diagonal",
  L: "Bentuk L (ada potongan)",
  titik: "Titik sudut bebas",
};

type Pt = { u: number; w: number };

function circleIntersect(a: Pt, ra: number, b: Pt, rb: number): [Pt, Pt] | null {
  const dx = b.u - a.u;
  const dy = b.w - a.w;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d > ra + rb + 1e-9 || d < Math.abs(ra - rb) - 1e-9) return null;
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const mx = a.u + (dx * x) / d;
  const my = a.w + (dy * x) / d;
  return [
    { u: mx - (dy * h) / d, w: my + (dx * h) / d },
    { u: mx + (dy * h) / d, w: my - (dx * h) / d },
  ];
}

function areaSigned(p: Pt[]) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.u * b.w - b.u * a.w;
  }
  return s / 2;
}

function segCross(a: Pt, b: Pt, c: Pt, d: Pt) {
  const o = (p: Pt, q: Pt, r: Pt) => (q.u - p.u) * (r.w - p.w) - (q.w - p.w) * (r.u - p.u);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

function selfIntersects(p: Pt[]) {
  const n = p.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segCross(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true;
    }
  return false;
}

export interface LandResult {
  pts: Pt[]; // lokal (u, w), sisi depan = titik 0 → 1
  error?: string;
  /** lebar (sepanjang sisi depan) & panjang/kedalaman kotak pembatas */
  bboxU: number;
  bboxW: number;
  area: number;
  /** panjang sisi depan (dipakai untuk 1/9 posisi pintu) */
  front: number;
}

export function buildLand(L: LandInput): LandResult {
  let pts: Pt[] = [];
  let error: string | undefined;
  const pos = (...v: number[]) => v.every((x) => Number.isFinite(x) && x > 0);
  switch (L.mode) {
    case "persegi":
      if (!pos(L.depan, L.dalam)) error = "Isi lebar depan dan panjang ke dalam.";
      pts = [
        { u: 0, w: 0 },
        { u: L.depan, w: 0 },
        { u: L.depan, w: L.dalam },
        { u: 0, w: L.dalam },
      ];
      break;
    case "trapesium":
      if (!pos(L.depan, L.belakang, L.dalam)) error = "Isi sisi depan, belakang, dan kedalaman.";
      pts = [
        { u: 0, w: 0 },
        { u: L.depan, w: 0 },
        { u: L.geser + L.belakang, w: L.dalam },
        { u: L.geser, w: L.dalam },
      ];
      break;
    case "ukur": {
      if (!pos(L.depan, L.kanan, L.belakang, L.kiri, L.diagonal)) {
        error = "Isi kelima ukuran (4 sisi + diagonal).";
        break;
      }
      const A = { u: 0, w: 0 };
      const B = { u: L.depan, w: 0 };
      const cc = circleIntersect(A, L.diagonal, B, L.kanan);
      if (!cc) {
        error = "Diagonal tidak cocok dengan sisi depan + kanan (segitiga tidak bisa terbentuk). Cek lagi ukurannya.";
        break;
      }
      const C = cc[0].w > 0 ? cc[0] : cc[1];
      const dd = circleIntersect(A, L.kiri, C, L.belakang);
      if (!dd) {
        error = "Sisi kiri + belakang tidak cocok dengan diagonal. Cek lagi ukurannya.";
        break;
      }
      // pilih titik D di sisi kiri garis AC (berseberangan dengan B)
      const side = (p: Pt) => C.u * p.w - C.w * p.u;
      const D = Math.sign(side(dd[0])) !== Math.sign(side(B)) ? dd[0] : dd[1];
      pts = [A, B, C, D];
      break;
    }
    case "L": {
      if (!pos(L.depan, L.dalam, L.potongLebar, L.potongDalam)) error = "Isi ukuran lahan dan potongan.";
      else if (L.potongLebar >= L.depan || L.potongDalam >= L.dalam) error = "Potongan harus lebih kecil dari lahan.";
      const F = L.depan;
      const D = L.dalam;
      const cw = L.potongLebar;
      const cd = L.potongDalam;
      pts =
        L.potongSisi === "kanan"
          ? [
              { u: 0, w: 0 },
              { u: F, w: 0 },
              { u: F, w: D - cd },
              { u: F - cw, w: D - cd },
              { u: F - cw, w: D },
              { u: 0, w: D },
            ]
          : [
              { u: 0, w: 0 },
              { u: F, w: 0 },
              { u: F, w: D },
              { u: cw, w: D },
              { u: cw, w: D - cd },
              { u: 0, w: D - cd },
            ];
      break;
    }
    case "titik": {
      const raw = L.titik
        .split(/\n|;/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(/[\s,]+/).map(Number));
      if (raw.length < 3 || raw.some((r) => r.length < 2 || r.some((x) => !Number.isFinite(x)))) {
        error = "Tulis minimal 3 titik, satu per baris: kanan,dalam (meter). Titik 1 → 2 = sisi depan.";
        break;
      }
      let p: Pt[] = raw.map(([u, w]) => ({ u, w }));
      // putar supaya titik 1 → 2 (sisi depan) lurus di w = 0
      const o = p[0];
      const ang = Math.atan2(p[1].w - o.w, p[1].u - o.u);
      const c = Math.cos(-ang);
      const s = Math.sin(-ang);
      p = p.map((q) => ({ u: (q.u - o.u) * c - (q.w - o.w) * s, w: (q.u - o.u) * s + (q.w - o.w) * c }));
      if (areaSigned(p) < 0) p = p.map((q) => ({ u: q.u, w: -q.w }));
      pts = p;
      break;
    }
  }
  if (!error && pts.length >= 3) {
    if (selfIntersects(pts)) error = "Sisi-sisi lahan saling berpotongan. Cek urutan / ukurannya.";
    if (pts.slice(2).some((q) => q.w < -0.05)) error = error ?? "Ada pojok yang berada di depan sisi depan (keluar ke jalan).";
  }
  const us = pts.map((q) => q.u);
  const ws = pts.map((q) => q.w);
  const bboxU = pts.length ? Math.max(...us) - Math.min(...us) : 0;
  const bboxW = pts.length ? Math.max(...ws) - Math.min(...ws) : 0;
  const front = pts.length >= 2 ? Math.hypot(pts[1].u - pts[0].u, pts[1].w - pts[0].w) : 0;
  return { pts, error, bboxU, bboxW, area: Math.abs(areaSigned(pts)), front };
}

/** panjang tiap sisi (untuk label) */
export function sideLengths(pts: { u: number; w: number }[]) {
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    return Math.hypot(b.u - a.u, b.w - a.w);
  });
}

/** lokal (u kanan, w masuk) → dunia (x timur, z selatan) sesuai arah gerbang */
export function landToWorld(pts: Pt[], gate: GateDirection): Vec2[] {
  const out: Record<GateDirection, Vec2> = {
    Utara: { x: 0, z: -1 },
    Selatan: { x: 0, z: 1 },
    Timur: { x: 1, z: 0 },
    Barat: { x: -1, z: 0 },
  };
  const o = out[gate];
  const r = { x: o.z, z: -o.x }; // kanan bagi orang di jalan yang menghadap lahan
  return pts.map((q) => ({ x: q.u * r.x - q.w * o.x, z: q.u * r.z - q.w * o.z }));
}

/** cek apakah lahan persegi panjang sumbu-lurus (pakai tampilan ukuran lama) */
export function isAxisRect(land: Vec2[]) {
  if (land.length !== 4) return false;
  const xs = new Set(land.map((p) => p.x.toFixed(3)));
  const zs = new Set(land.map((p) => p.z.toFixed(3)));
  return xs.size === 2 && zs.size === 2;
}
