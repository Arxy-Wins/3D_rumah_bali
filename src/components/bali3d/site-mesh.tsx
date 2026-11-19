"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { Vec2 } from "../../lib/bali3d/segmentation";
import type { PlacedBuilding } from "../../lib/bali3d/layout";
import type { SiteReport } from "../../lib/bali3d/seismic";

const WALL_H = 1.8;
const WALL_T = 0.22;

export function Ground({ land }: { land: Vec2[] }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    land.forEach((p, i) => (i === 0 ? s.moveTo(p.x, -p.z) : s.lineTo(p.x, -p.z)));
    s.closePath();
    return s;
  }, [land]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#7fa35c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#cdb68c" roughness={1} />
      </mesh>
    </group>
  );
}

/** Tembok penyengker mengikuti kontur lahan, berlubang di posisi angkul-angkul */
export function Penyengker({
  land,
  gate,
  reinforced,
}: {
  land: Vec2[];
  gate: PlacedBuilding | undefined;
  reinforced: boolean;
}) {
  const segments = useMemo(() => {
    const out: { a: Vec2; b: Vec2 }[] = [];
    for (let i = 0; i < land.length; i++) {
      const a = land[i];
      const b = land[(i + 1) % land.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      if (gate) {
        const t = ((gate.center.x - a.x) * dx + (gate.center.z - a.z) * dz) / (len * len);
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        const dist = Math.hypot(gate.center.x - px, gate.center.z - pz);
        if (t > 0 && t < 1 && dist < 1.6) {
          const half = gate.W / 2 / len;
          const t0 = Math.max(0, t - half);
          const t1 = Math.min(1, t + half);
          if (t0 > 0.001) out.push({ a, b: { x: a.x + dx * t0, z: a.z + dz * t0 } });
          if (t1 < 0.999) out.push({ a: { x: a.x + dx * t1, z: a.z + dz * t1 }, b });
          continue;
        }
      }
      out.push({ a, b });
    }
    return out;
  }, [land, gate]);

  return (
    <group>
      {segments.map(({ a, b }, i) => {
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const ang = Math.atan2(b.z - a.z, b.x - a.x);
        const n = Math.max(2, Math.ceil(len / 3) + 1);
        return (
          <group key={i} position={[(a.x + b.x) / 2, 0, (a.z + b.z) / 2]} rotation={[0, -ang, 0]}>
            <mesh position={[0, WALL_H / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[len + WALL_T, WALL_H, WALL_T]} />
              <meshStandardMaterial color="#b0573c" roughness={0.9} />
            </mesh>
            <mesh position={[0, WALL_H + 0.06, 0]} castShadow>
              <boxGeometry args={[len + WALL_T + 0.06, 0.12, WALL_T + 0.08]} />
              <meshStandardMaterial color={reinforced ? "#8e9296" : "#bdb4a3"} />
            </mesh>
            {reinforced &&
              Array.from({ length: n }, (_, k) => -len / 2 + (len * k) / (n - 1)).map((x, k) => (
                <mesh key={k} position={[x, WALL_H / 2, 0]}>
                  <boxGeometry args={[0.18, WALL_H, WALL_T + 0.02]} />
                  <meshStandardMaterial color="#8e9296" />
                </mesh>
              ))}
          </group>
        );
      })}
    </group>
  );
}

function roundedRectShape(w: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -d / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + d - r);
  s.absarc(x0 + w - r, y0 + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y0 + d);
  s.absarc(x0 + r, y0 + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, (3 * Math.PI) / 2, false);
  return s;
}

/** Zona runtuh: garis atap diperbesar sejauh radius runtuh */
export function CollapseZone({ b, radius }: { b: PlacedBuilding; radius: number }) {
  const { geo, outline } = useMemo(() => {
    const shape = roundedRectShape(b.W + 2 * radius, b.D + 2 * radius, Math.max(radius, 0.01));
    const pts = shape.getPoints(12).map((p) => new THREE.Vector3(p.x, 0, -p.y));
    return { geo: new THREE.ShapeGeometry(shape, 12), outline: [...pts, pts[0]] };
  }, [b.W, b.D, radius]);
  return (
    <group position={[b.center.x, 0.03, b.center.z]} rotation={[0, b.phi, 0]}>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#ef4444" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <Line points={outline} color="#ef4444" lineWidth={1.2} dashed dashSize={0.3} gapSize={0.2} />
    </group>
  );
}

export function SafeArea({ cells, size }: { cells: Vec2[]; size: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    cells.forEach((c, i) => {
      o.position.set(c.x, 0.04, c.z);
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [cells]);
  if (!cells.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cells.length]} key={cells.length}>
      <planeGeometry args={[size * 0.96, size * 0.96]} />
      <meshBasicMaterial color="#16a34a" transparent opacity={0.35} depthWrite={false} />
    </instancedMesh>
  );
}

export function AssemblyMarker({ p, safe }: { p: Vec2; safe: boolean }) {
  const color = safe ? "#16a34a" : "#f59e0b";
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 2.4, 8]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>
      <mesh position={[0.35, 2.2, 0]}>
        <boxGeometry args={[0.7, 0.4, 0.02]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.7, 0.9, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

export function EvacuationRoutes({ routes }: { routes: SiteReport["routes"] }) {
  return (
    <group>
      {routes
        .filter((r) => r.reachable && r.points.length > 1)
        .map((r, i) => {
          const pts = r.points.map((p) => new THREE.Vector3(p.x, 0.09, p.z));
          const last = r.points[r.points.length - 1];
          const prev = r.points[r.points.length - 2];
          const ang = Math.atan2(last.x - prev.x, last.z - prev.z);
          const color = r.from.startsWith("Titik") ? "#0ea5e9" : "#22c55e";
          return (
            <group key={i}>
              <Line points={pts} color={color} lineWidth={3} dashed dashSize={0.4} gapSize={0.2} />
              <group position={[last.x, 0.12, last.z]} rotation={[0, ang, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[0.18, 0.45, 12]} />
                  <meshBasicMaterial color={color} />
                </mesh>
              </group>
            </group>
          );
        })}
    </group>
  );
}
