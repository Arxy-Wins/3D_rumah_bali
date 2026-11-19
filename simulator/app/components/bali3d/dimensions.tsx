"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import type { Vec2 } from "../../lib/bali3d/segmentation";
import type { PlacedBuilding } from "../../lib/bali3d/layout";
import { type AstaParams, DISTANCE_RULES, kajaDir, ruleDistances } from "../../lib/bali3d/asta-rules";

/** format meter gaya Indonesia: 6,05 m */
export const fmtM = (v: number, d = 2) => `${v.toFixed(d).replace(".", ",")} m`;

const Y = 0.07;

function Label({ p, text, color = "#111827", small = false }: { p: Vec2; text: string; color?: string; small?: boolean }) {
  return (
    <Html position={[p.x, Y + 0.05, p.z]} center style={{ pointerEvents: "none" }}>
      <div
        className={`whitespace-nowrap rounded px-1 font-semibold shadow ${small ? "text-[10px]" : "text-[11px]"}`}
        style={{ background: "rgba(255,255,255,0.92)", color }}
      >
        {text}
      </div>
    </Html>
  );
}

/** garis ukur dengan tanda ujung, seperti pada gambar kerja 2D */
function DimLine({ a, b, color, label, labelColor }: { a: Vec2; b: Vec2; color: string; label: string; labelColor?: string }) {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const n = { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
  const t = 0.25;
  const tick = (p: Vec2) => [new THREE.Vector3(p.x - n.x * t, Y, p.z - n.z * t), new THREE.Vector3(p.x + n.x * t, Y, p.z + n.z * t)];
  return (
    <group>
      <Line points={[new THREE.Vector3(a.x, Y, a.z), new THREE.Vector3(b.x, Y, b.z)]} color={color} lineWidth={1.6} />
      <Line points={tick(a)} color={color} lineWidth={1.6} />
      <Line points={tick(b)} color={color} lineWidth={1.6} />
      <Label p={{ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }} text={label} color={labelColor ?? color} />
    </group>
  );
}

/** ukuran lahan: lebar (timur–barat) di sisi utara, panjang (utara–selatan) di sisi barat */
export function LandDimensions({ land }: { land: Vec2[] }) {
  if (land.length < 3) return null;
  const xs = land.map((p) => p.x);
  const zs = land.map((p) => p.z);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  const off = 1.4;
  return (
    <group>
      <DimLine a={{ x: x0, z: z0 - off }} b={{ x: x1, z: z0 - off }} color="#1d4ed8" label={`Lebar ${fmtM(x1 - x0, 1)}`} />
      <DimLine a={{ x: x0 - off, z: z0 }} b={{ x: x0 - off, z: z1 }} color="#1d4ed8" label={`Panjang ${fmtM(z1 - z0, 1)}`} />
    </group>
  );
}

// ---- titik terdekat antar persegi (untuk garis jarak aturan) ----
function closestOnSeg(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / (vx * vx + vz * vz || 1)));
  return { x: a.x + vx * t, z: a.z + vz * t };
}
function closestPair(A: Vec2[], B: Vec2[]): [Vec2, Vec2] {
  let best: [Vec2, Vec2] = [A[0], B[0]];
  let bd = Infinity;
  const test = (P: Vec2[], Q: Vec2[], flip: boolean) => {
    for (const p of P)
      for (let i = 0; i < Q.length; i++) {
        const q = closestOnSeg(p, Q[i], Q[(i + 1) % Q.length]);
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (d < bd) {
          bd = d;
          best = flip ? [q, p] : [p, q];
        }
      }
  };
  test(A, B, false);
  test(B, A, true);
  return best;
}

/** garis jarak aturan Asta Kosala Kosali di 3D (hijau = sesuai, merah = tidak) */
export function RuleDistanceLines({ buildings, land, asta }: { buildings: PlacedBuilding[]; land: Vec2[]; asta: AstaParams }) {
  const lines = useMemo(() => {
    const targets = ruleDistances(asta);
    const k = kajaDir(asta.orientation);
    const find = (t: string) => buildings.find((b) => b.type === t);
    const out: { a: Vec2; b: Vec2; target: number; actual: number; key: string }[] = [];
    for (const r of DISTANCE_RULES) {
      const A = find(r.a);
      if (!A) continue;
      let pair: [Vec2, Vec2] | null = null;
      if (r.b === "tembok_kaja") {
        let bd = Infinity;
        for (let i = 0; i < land.length; i++) {
          const e0 = land[i];
          const e1 = land[(i + 1) % land.length];
          const mid = { x: (e0.x + e1.x) / 2, z: (e0.z + e1.z) / 2 };
          if (mid.x * k.x + mid.z * k.z <= 0) continue; // hanya tepi di sisi kaja
          const nx = -(e1.z - e0.z);
          const nz = e1.x - e0.x;
          const nl = Math.hypot(nx, nz) || 1;
          if (Math.abs((nx * k.x + nz * k.z) / nl) < 0.7) continue;
          for (const c of A.roofCorners) {
            const q = closestOnSeg(c, e0, e1);
            const d = Math.hypot(c.x - q.x, c.z - q.z);
            if (d < bd) {
              bd = d;
              pair = [c, q];
            }
          }
        }
      } else if (r.b === "sudut_kaja_kauh") {
        const dir = { x: k.x - 1, z: k.z };
        let corner = land[0];
        for (const q of land) if (q.x * dir.x + q.z * dir.z > corner.x * dir.x + corner.z * dir.z) corner = q;
        pair = closestPair([corner], A.roofCorners);
      } else {
        const B = find(r.b);
        if (B) pair = closestPair(A.roofCorners, B.roofCorners);
      }
      if (!pair) continue;
      const actual = Math.hypot(pair[0].x - pair[1].x, pair[0].z - pair[1].z);
      out.push({ a: pair[0], b: pair[1], target: targets[r.id], actual, key: r.id });
    }
    return out;
  }, [buildings, land, asta]);

  return (
    <group>
      {lines.map((l) => {
        const ok = Math.abs(l.actual - l.target) <= Math.max(0.25, 0.1 * l.target);
        const color = ok ? "#16a34a" : "#dc2626";
        if (l.actual < 0.05) return null;
        return <DimLine key={l.key} a={l.a} b={l.b} color={color} label={fmtM(l.actual)} />;
      })}
    </group>
  );
}

/** garis ukur satu bangunan: panjang (depan), lebar (samping), tinggi (vertikal) */
export function BuildingDims({ b }: { b: PlacedBuilding }) {
  const off = 0.9;
  const W = b.W;
  const D = b.D;
  const H = b.height;
  const front = { a: { x: -W / 2, z: D / 2 + off }, b: { x: W / 2, z: D / 2 + off } };
  const side = { a: { x: W / 2 + off, z: -D / 2 }, b: { x: W / 2 + off, z: D / 2 } };
  const cx = W / 2 + off;
  const cz = D / 2 + off;
  return (
    <group position={[b.center.x, 0, b.center.z]} rotation={[0, b.phi, 0]}>
      <DimLine a={front.a} b={front.b} color="#1d4ed8" label={`P ${fmtM(W)}`} />
      <DimLine a={side.a} b={side.b} color="#1d4ed8" label={`L ${fmtM(D)}`} />
      <Line points={[new THREE.Vector3(cx, 0, cz), new THREE.Vector3(cx, H, cz)]} color="#1d4ed8" lineWidth={1.6} />
      <Line points={[new THREE.Vector3(cx - 0.25, H, cz), new THREE.Vector3(cx + 0.25, H, cz)]} color="#1d4ed8" lineWidth={1.6} />
      <Html position={[cx, H / 2, cz]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded bg-white/90 px-1 text-[11px] font-semibold text-blue-700 shadow">T {fmtM(H)}</div>
      </Html>
    </group>
  );
}
