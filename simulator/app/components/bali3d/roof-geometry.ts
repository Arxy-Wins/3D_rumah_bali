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
