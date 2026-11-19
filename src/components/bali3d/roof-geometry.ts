import * as THREE from "three";

/**
 * Semua geometri atap dibuat dalam koordinat lokal: alas atap (garis teritisan)
 * di y = 0, berpusat di (0,0), lebar W pada sumbu x dan dalam D pada sumbu z.
 */

function fromTriangles(tris: number[][]): THREE.BufferGeometry {
  const pos = new Float32Array(tris.flat());
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Atap limasan (perisai). Bila W≈D menjadi atap piramida. */
export function hipRoof(W: number, D: number, rise: number): THREE.BufferGeometry {
  const swap = D > W;
  const L = swap ? D : W;
  const S = swap ? W : D;
  const r = (L - S) / 2;
  const A = [-L / 2, 0, -S / 2];
  const B = [L / 2, 0, -S / 2];
  const C = [L / 2, 0, S / 2];
  const Dd = [-L / 2, 0, S / 2];
  const R1 = [-r, rise, 0];
  const R2 = [r, rise, 0];
  const tris = [
    // depan (+z)
    [...Dd, ...C, ...R2],
    [...Dd, ...R2, ...R1],
    // belakang
    [...B, ...A, ...R1],
    [...B, ...R1, ...R2],
    // samping
    [...A, ...Dd, ...R1],
    [...C, ...B, ...R2],
  ];
  const g = fromTriangles(tris);
  if (swap) g.rotateY(Math.PI / 2);
  return g;
}

/** Atap pelana; bubungan sejajar sumbu x (atau z bila ridgeAlongZ). */
export function gableRoof(W: number, D: number, rise: number, ridgeAlongZ = false): THREE.BufferGeometry {
  const L = ridgeAlongZ ? D : W;
  const S = ridgeAlongZ ? W : D;
  const A = [-L / 2, 0, -S / 2];
  const B = [L / 2, 0, -S / 2];
  const C = [L / 2, 0, S / 2];
  const Dd = [-L / 2, 0, S / 2];
  const R1 = [-L / 2, rise, 0];
  const R2 = [L / 2, rise, 0];
  const g = fromTriangles([
    [...Dd, ...C, ...R2],
    [...Dd, ...R2, ...R1],
    [...B, ...A, ...R1],
    [...B, ...R1, ...R2],
  ]);
  if (ridgeAlongZ) g.rotateY(Math.PI / 2);
  return g;
}

/** Segitiga tutup pelana (dinding gewel) di posisi x = ±xPos (sebelum rotasi) */
export function gableEnds(halfSpan: number, rise: number, xPos: number, ridgeAlongZ = false): THREE.BufferGeometry {
  const g = fromTriangles([
    [xPos, 0, -halfSpan, xPos, 0, halfSpan, xPos, rise, 0],
    [-xPos, 0, halfSpan, -xPos, 0, -halfSpan, -xPos, rise, 0],
  ]);
  if (ridgeAlongZ) g.rotateY(Math.PI / 2);
  return g;
}

// ---------------- atap melengkung (dikalibrasi dari gambar dataset) ----------------

/**
 * Profil lereng atap, s = 0 (kaki atap) … 1 (bubungan):
 *  - "flare" : alang-alang bale — kaki atap landai/melebar, makin curam ke atas
 *  - "dome"  : ijuk pelinggih/gedong — cembung seperti kubah
 *  - "ogive" : jineng — sisi hampir tegak di bawah, runcing di puncak
 * h(s) = porsi jarak horizontal dari kaki ke bubungan, v(s) = porsi tinggi.
 */
export type RoofProfile = "flat" | "flare" | "dome" | "ogive";

function profileFns(p: RoofProfile) {
  switch (p) {
    case "flare":
      return { h: (s: number) => s, v: (s: number) => Math.pow(s, 1.35), hInv: (x: number) => x };
    case "dome":
      return { h: (s: number) => s, v: (s: number) => 1 - Math.pow(1 - s, 1.8), hInv: (x: number) => x };
    case "ogive":
      return { h: (s: number) => Math.pow(s, 1.8), v: (s: number) => s, hInv: (x: number) => Math.pow(Math.max(x, 0), 1 / 1.8) };
    default:
      return { h: (s: number) => s, v: (s: number) => s, hInv: (x: number) => x };
  }
}

type P3 = [number, number, number];

/** satu bidang lereng: tepi kaki (e0→e1, y=0) ke tepi bubungan (r0→r1, y=rise) */
function slopeFace(e0: P3, e1: P3, r0: P3, r1: P3, rise: number, prof: RoofProfile, pos: number[], idx: number[], rows = 10) {
  const f = profileFns(prof);
  const base = pos.length / 3;
  for (let i = 0; i <= rows; i++) {
    const s = i / rows;
    const hs = f.h(s);
    const y = rise * f.v(s);
    for (const u of [0, 1]) {
      const ex = e0[0] + (e1[0] - e0[0]) * u;
      const ez = e0[2] + (e1[2] - e0[2]) * u;
      const rx = r0[0] + (r1[0] - r0[0]) * u;
      const rz = r0[2] + (r1[2] - r0[2]) * u;
      pos.push(ex + (rx - ex) * hs, y, ez + (rz - ez) * hs);
    }
  }
  for (let i = 0; i < rows; i++) {
    const a = base + i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
}

function build(pos: number[], idx: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function curvedHipRoof(W: number, D: number, rise: number, prof: RoofProfile): THREE.BufferGeometry {
  if (prof === "flat") return hipRoof(W, D, rise);
  const swap = D > W;
  const L = swap ? D : W;
  const S = swap ? W : D;
  const r = (L - S) / 2;
  const A: P3 = [-L / 2, 0, -S / 2];
  const B: P3 = [L / 2, 0, -S / 2];
  const C: P3 = [L / 2, 0, S / 2];
  const Dd: P3 = [-L / 2, 0, S / 2];
  const R1: P3 = [-r, rise, 0];
  const R2: P3 = [r, rise, 0];
  const pos: number[] = [];
  const idx: number[] = [];
  slopeFace(Dd, C, R1, R2, rise, prof, pos, idx); // depan
  slopeFace(B, A, R2, R1, rise, prof, pos, idx); // belakang
  slopeFace(A, Dd, R1, R1, rise, prof, pos, idx); // samping kiri
  slopeFace(C, B, R2, R2, rise, prof, pos, idx); // samping kanan
  const g = build(pos, idx);
  if (swap) g.rotateY(Math.PI / 2);
  return g;
}

export function curvedGableRoof(W: number, D: number, rise: number, alongZ: boolean, prof: RoofProfile): THREE.BufferGeometry {
  if (prof === "flat") return gableRoof(W, D, rise, alongZ);
  const L = alongZ ? D : W;
  const S = alongZ ? W : D;
  const pos: number[] = [];
  const idx: number[] = [];
  slopeFace([-L / 2, 0, S / 2], [L / 2, 0, S / 2], [-L / 2, rise, 0], [L / 2, rise, 0], rise, prof, pos, idx);
  slopeFace([L / 2, 0, -S / 2], [-L / 2, 0, -S / 2], [L / 2, rise, 0], [-L / 2, rise, 0], rise, prof, pos, idx);
  const g = build(pos, idx);
  if (alongZ) g.rotateY(Math.PI / 2);
  return g;
}

/** tutup gewel mengikuti profil atap, di x = ±xPos, dimulai `inset` dari kaki atap */
export function curvedGableEnds(halfSpan: number, rise: number, xPos: number, inset: number, prof: RoofProfile, alongZ: boolean) {
  const f = profileFns(prof);
  const s0 = Math.min(0.95, f.hInv(inset / Math.max(halfSpan, 0.01)));
  const outline: [number, number][] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const s = s0 + ((1 - s0) * i) / N;
    outline.push([halfSpan * (1 - f.h(s)), rise * f.v(s)]);
  }
  const y0 = outline[0][1];
  const pos: number[] = [];
  const idx: number[] = [];
  for (const sx of [1, -1]) {
    const base = pos.length / 3;
    pos.push(sx * xPos, y0, 0); // pusat bawah
    // sisi +z naik ke puncak lalu turun ke sisi -z
    const pts: [number, number][] = [...outline.map(([o, y]) => [o, y] as [number, number]), ...outline.slice(0, -1).reverse().map(([o, y]) => [-o, y] as [number, number])];
    pts.forEach(([zz, y]) => pos.push(sx * xPos, y, zz));
    for (let i = 1; i < pts.length; i++) idx.push(base, base + i, base + i + 1 > base + pts.length ? base + 1 : base + i + 1);
  }
  const g = build(pos, idx);
  if (alongZ) g.rotateY(Math.PI / 2);
  return { geometry: g, baseY: y0 };
}
