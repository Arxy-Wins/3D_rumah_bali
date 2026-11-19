"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { PlacedBuilding } from "../../lib/bali3d/layout";
import type { BuildingReport } from "../../lib/bali3d/seismic";
import { ROOF_COLORS, roofBaseHeight, roofRise } from "../../lib/bali3d/specs";
import { gableEnds, gableRoof, hipRoof } from "./roof-geometry";
import { useShake } from "./shake";

export type RoofMode = "solid" | "transparent" | "lifted" | "hidden";

export interface ViewFlags {
  roofMode: RoofMode;
  showMitigation: boolean;
  showLabels: boolean;
  mitigationApplied: boolean;
}

const C = {
  paras: "#bdb4a3",
  parasDark: "#8f8676",
  bata: "#b4553a",
  kayu: "#7b4a28",
  kayuDark: "#5a3219",
  beton: "#8e9296",
  floor: "#d8cdb5",
  angkur: "#d42a2a",
  brace: "#c98a2b",
  prada: "#c99a2e",
  shrine: "#7a2e1c",
};

const RISK_COLOR: Record<BuildingReport["level"], string> = {
  Rendah: "#22c55e",
  Sedang: "#f59e0b",
  Tinggi: "#ef4444",
};

function Box({
  size,
  position,
  color,
  rotation,
  opacity = 1,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  opacity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} roughness={0.85} />
    </mesh>
  );
}

function linspace(a: number, b: number, n: number) {
  if (n <= 1) return [(a + b) / 2];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

/** dinding dengan opsi lubang pintu + perkuatan (kolom praktis & ring balok) */
function Wall({
  length,
  height,
  position,
  rotationY,
  color,
  door,
  reinforced,
}: {
  length: number;
  height: number;
  position: [number, number, number];
  rotationY: number;
  color: string;
  door?: boolean;
  reinforced: boolean;
}) {
  const t = 0.15;
  const doorW = Math.min(0.9, length * 0.4);
  const doorH = Math.min(1.9, height * 0.85);
  const parts: React.ReactNode[] = [];
  if (door) {
    const side = (length - doorW) / 2;
    parts.push(
      <Box key="l" size={[side, height, t]} position={[-(doorW + side) / 2, height / 2, 0]} color={color} />,
      <Box key="r" size={[side, height, t]} position={[(doorW + side) / 2, height / 2, 0]} color={color} />,
      <Box key="top" size={[doorW, height - doorH, t]} position={[0, doorH + (height - doorH) / 2, 0]} color={color} />,
      <Box key="door" size={[doorW, doorH, 0.05]} position={[0, doorH / 2, 0.06]} color={C.kayuDark} />
    );
  } else {
    parts.push(<Box key="w" size={[length, height, t]} position={[0, height / 2, 0]} color={color} />);
  }
  if (reinforced) {
    const n = Math.max(2, Math.ceil(length / 3) + 1);
    linspace(-length / 2 + 0.08, length / 2 - 0.08, n).forEach((x, i) =>
      parts.push(<Box key={`kp${i}`} size={[0.16, height, t + 0.02]} position={[x, height / 2, 0]} color={C.beton} />)
    );
    parts.push(<Box key="rb" size={[length, 0.15, t + 0.03]} position={[0, height - 0.075, 0]} color={C.beton} />);
    parts.push(<Box key="sl" size={[length, 0.12, t + 0.03]} position={[0, 0.06, 0]} color={C.beton} />);
  }
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {parts}
    </group>
  );
}

function RoofMaterial({ color, mode, side = THREE.DoubleSide }: { color: string; mode: RoofMode; side?: THREE.Side }) {
  const transparent = mode === "transparent";
  return (
    <meshStandardMaterial
      color={color}
      side={side}
      flatShading
      roughness={0.95}
      transparent={transparent}
      opacity={transparent ? 0.28 : 1}
      depthWrite={!transparent}
    />
  );
}

function Roof({
  kind,
  W,
  D,
  rise,
  color,
  mode,
  gableColor,
  gableInset = 0,
}: {
  kind: "hip" | "gable" | "gableZ";
  W: number;
  D: number;
  rise: number;
  color: string;
  mode: RoofMode;
  gableColor?: string;
  gableInset?: number;
}) {
  const geo = useMemo(() => {
    if (kind === "hip") return hipRoof(W, D, rise);
    return gableRoof(W, D, rise, kind === "gableZ");
  }, [kind, W, D, rise]);
  const ends = useMemo(() => {
    if (kind === "hip") return null;
    const alongZ = kind === "gableZ";
    const L = alongZ ? D : W;
    const S = alongZ ? W : D;
    const k = 1 - (2 * gableInset) / Math.max(S, 0.1);
    return gableEnds((S / 2) * k, rise * k, L / 2 - gableInset, alongZ);
  }, [kind, W, D, rise, gableInset]);
  if (mode === "hidden") return null;
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <RoofMaterial color={color} mode={mode} />
      </mesh>
      {/* tebal atap (alang-alang/ijuk tebal) */}
      <mesh geometry={geo} position={[0, -0.14, 0]} scale={[0.995, 1, 0.995]}>
        <RoofMaterial color={new THREE.Color(color).multiplyScalar(0.55).getStyle()} mode={mode} />
      </mesh>
      {ends && (
        <mesh geometry={ends} position={[0, gableInset * Math.tan(Math.atan2(rise, (kind === "gableZ" ? W : D) / 2)), 0]}>
          <RoofMaterial color={gableColor ?? C.kayu} mode={mode} />
        </mesh>
      )}
    </group>
  );
}

/** Pelinggih (bangunan suci kecil): bebaturan paras, rong kayu, atap ijuk */
function Pelinggih({ s, baseH, bodyH, roofMode, showMitigation }: { s: number; baseH: number; bodyH: number; roofMode: RoofMode; showMitigation: boolean }) {
  const bodyS = s * 0.68;
  const roofS = s * 1.15;
  const rise = (roofS / 2) * Math.tan((55 * Math.PI) / 180);
  return (
    <group>
      <Box size={[s, baseH * 0.15, s]} position={[0, baseH * 0.075, 0]} color={C.parasDark} />
      <Box size={[s * 0.82, baseH * 0.7, s * 0.82]} position={[0, baseH * 0.15 + baseH * 0.35, 0]} color={C.paras} />
      <Box size={[s * 0.95, baseH * 0.15, s * 0.95]} position={[0, baseH * 0.925, 0]} color={C.parasDark} />
      <Box size={[bodyS, bodyH, bodyS]} position={[0, baseH + bodyH / 2, 0]} color={C.shrine} />
      <Box size={[bodyS * 0.45, bodyH * 0.6, 0.03]} position={[0, baseH + bodyH * 0.45, bodyS / 2 + 0.016]} color={C.prada} />
      <group position={[0, baseH + bodyH, 0]}>
        <Roof kind="hip" W={roofS} D={roofS} rise={rise} color={ROOF_COLORS.ijuk} mode={roofMode} />
      </group>
      {showMitigation && (
        <mesh position={[0, baseH + 0.05, 0]}>
          <torusGeometry args={[bodyS * 0.75, 0.025, 6, 24]} />
          <meshStandardMaterial color={C.angkur} />
        </mesh>
      )}
    </group>
  );
}

export function BaliBuilding({
  b,
  report,
  flags,
  selected,
  onSelect,
}: {
  b: PlacedBuilding;
  report?: BuildingReport;
  flags: ViewFlags;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const s = b.spec;
  const tiltRef = useRef<THREE.Group>(null);
  const shake = useShake();

  // amplifikasi dinamis sederhana: rasio periode bangunan vs periode guncangan
  const sway = useMemo(() => {
    const T = report?.periodS ?? 0.15;
    const risk = flags.mitigationApplied ? 0 : report?.score ?? 0;
    return { T, risk };
  }, [report, flags.mitigationApplied]);

  useFrame(({ clock }) => {
    const g = tiltRef.current;
    if (!g) return;
    const st = shake.current;
    if (!st.active) {
      g.rotation.z *= 0.9;
      g.rotation.x *= 0.9;
      return;
    }
    const t = clock.getElapsedTime() - st.start;
    const env = Math.min(1, t / 1.5) * Math.max(0, Math.min(1, (st.duration - t) / 2));
    const Tg = 1 / st.freq;
    const r = sway.T / Tg;
    const zeta = 0.05;
    const amp = 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2);
    const k = st.intensity * (0.012 + 0.006 * sway.risk) * Math.min(amp, 4);
    g.rotation.z = -k * Math.sin(2 * Math.PI * st.freq * t - 0.6) * env;
    g.rotation.x = 0.35 * k * Math.sin(2 * Math.PI * st.freq * 0.83 * t + 1.1) * env;
  });

  const isShrine = s.roofType === "pelinggih";
  const isGate = s.roofType === "gate";
  const roofLift = flags.roofMode === "lifted" ? 2.6 : 0;
  const roofColor = ROOF_COLORS[s.roofMaterial];
  const wallColor = s.wallMaterial === "paras" ? C.paras : s.wallMaterial === "kayu" ? C.kayu : C.bata;
  const showMit = flags.showMitigation || flags.mitigationApplied;

  let content: React.ReactNode;

  if (isShrine) {
    // merajan: tembok rendah + beberapa pelinggih di sisi belakang; penunggun: satu pelinggih
    if (s.type === "merajan") {
      const n = Math.max(1, Math.min(3, Math.round((b.W * b.D) / 6)));
      const ps = Math.min((b.W * 0.8) / n, b.D * 0.42, 1.5);
      const xs = linspace(-b.W / 2 + ps * 0.7, b.W / 2 - ps * 0.7, n);
      const wallH = 1.0;
      const gap = 1.0;
      const side = (b.W - gap) / 2;
      content = (
        <group>
          <Box size={[b.W, 0.08, b.D]} position={[0, 0.04, 0]} color={C.floor} />
          <Box size={[b.W, wallH, 0.2]} position={[0, wallH / 2, -b.D / 2 + 0.1]} color={C.paras} />
          <Box size={[0.2, wallH, b.D]} position={[-b.W / 2 + 0.1, wallH / 2, 0]} color={C.paras} />
          <Box size={[0.2, wallH, b.D]} position={[b.W / 2 - 0.1, wallH / 2, 0]} color={C.paras} />
          <Box size={[side, wallH, 0.2]} position={[-(gap + side) / 2, wallH / 2, b.D / 2 - 0.1]} color={C.paras} />
          <Box size={[side, wallH, 0.2]} position={[(gap + side) / 2, wallH / 2, b.D / 2 - 0.1]} color={C.paras} />
          {xs.map((x, i) => (
            <group key={i} position={[x, 0, -b.D / 2 + ps * 0.75 + 0.2]}>
              <Pelinggih s={ps} baseH={s.plinthHeight * (i === Math.floor(n / 2) ? 1.15 : 1)} bodyH={s.sakaHeight} roofMode={flags.roofMode} showMitigation={showMit} />
            </group>
          ))}
        </group>
      );
    } else {
      const ps = Math.min(b.W, b.D) * 0.85;
      content = <Pelinggih s={ps} baseH={s.plinthHeight} bodyH={s.sakaHeight} roofMode={flags.roofMode} showMitigation={showMit} />;
    }
  } else if (isGate) {
    const opening = Math.min(1.2, b.bodyW * 0.5);
    const pw = (b.bodyW - opening) / 2;
    const h = s.sakaHeight;
    const lintelH = 0.6;
    const topW = b.bodyW * 0.9;
    content = (
      <group>
        <Box size={[b.bodyW + 0.2, s.plinthHeight, b.bodyD + 0.3]} position={[0, s.plinthHeight / 2, 0]} color={C.parasDark} />
        {[-1, 1].map((sgn) => (
          <group key={sgn} position={[sgn * (opening / 2 + pw / 2), s.plinthHeight, 0]}>
            <Box size={[pw, h, b.bodyD]} position={[0, h / 2, 0]} color={C.bata} />
            <Box size={[pw + 0.06, 0.18, b.bodyD + 0.06]} position={[0, h * 0.35, 0]} color={C.paras} />
            <Box size={[pw + 0.06, 0.18, b.bodyD + 0.06]} position={[0, h - 0.1, 0]} color={C.paras} />
            {flags.mitigationApplied && <Box size={[0.16, h, 0.16]} position={[0, h / 2, b.bodyD / 2 + 0.01]} color={C.beton} />}
          </group>
        ))}
        <Box size={[b.bodyW, lintelH, b.bodyD]} position={[0, s.plinthHeight + h + lintelH / 2, 0]} color={C.bata} />
        {flags.mitigationApplied && (
          <Box size={[b.bodyW + 0.02, 0.16, b.bodyD + 0.02]} position={[0, s.plinthHeight + h + 0.08, 0]} color={C.beton} />
        )}
        <group position={[0, s.plinthHeight + h + lintelH + roofLift, 0]}>
          {flags.roofMode !== "hidden" && (
            <>
              <Box size={[topW, 0.25, b.bodyD * 1.1]} position={[0, 0.125, 0]} color={C.paras} opacity={flags.roofMode === "transparent" ? 0.3 : 1} />
              <group position={[0, 0.25, 0]}>
                <Roof kind="hip" W={topW * 1.05} D={b.bodyD * 1.3} rise={0.9} color={roofColor} mode={flags.roofMode} />
              </group>
            </>
          )}
        </group>
      </group>
    );
  } else {
    // ---- bale (badan bangunan bertiang) ----
    const bw = b.bodyW;
    const bd = b.bodyD;
    const ph = s.plinthHeight;
    const isJineng = s.roofType === "jineng";
    const inset = 0.28;
    const [nx, nz] = s.sakaGrid;
    const cols: [number, number][] = [];
    linspace(-bw / 2 + inset, bw / 2 - inset, nx).forEach((x) =>
      linspace(-bd / 2 + inset, bd / 2 - inset, nz).forEach((z) => cols.push([x, z]))
    );
    const umpakH = 0.22;
    const sakaH = s.sakaHeight - umpakH;
    const top = ph + s.sakaHeight;
    const spanX = bw - 2 * inset;
    const spanZ = bd - 2 * inset;
    const steps = Math.max(1, Math.round(ph / 0.2));
    const roofBase = roofBaseHeight(s);
    const rise = roofRise(s, b.W, b.D);
    const wallH = sakaH + umpakH - 0.05;
    const reinforced = flags.mitigationApplied && (s.wallMaterial === "bata" || s.wallMaterial === "paras");

    content = (
      <group>
        {/* bebaturan + undakan */}
        <Box size={[bw, ph, bd]} position={[0, ph / 2, 0]} color={C.paras} />
        <Box size={[bw + 0.06, 0.06, bd + 0.06]} position={[0, ph - 0.03, 0]} color={C.floor} />
        {Array.from({ length: steps }, (_, i) => {
          const sh = ph * ((i + 1) / (steps + 1));
          return (
            <Box key={i} size={[1.1, sh, 0.32]} position={[0, sh / 2, bd / 2 + 0.16 + (steps - 1 - i) * 0.3]} color={C.parasDark} />
          );
        })}

        {/* sendi/umpak + saka */}
        {cols.map(([x, z], i) => (
          <group key={i} position={[x, ph, z]}>
            <Box size={[0.34, umpakH, 0.34]} position={[0, umpakH / 2, 0]} color={C.parasDark} />
            <Box size={[0.15, sakaH, 0.15]} position={[0, umpakH + sakaH / 2, 0]} color={C.kayu} />
            {showMit && (
              <mesh position={[0, umpakH + 0.12, 0]}>
                <boxGeometry args={[0.2, 0.08, 0.2]} />
                <meshStandardMaterial color={C.angkur} metalness={0.6} roughness={0.3} />
              </mesh>
            )}
          </group>
        ))}

        {/* lambang & sineb (balok keliling) */}
        <Box size={[spanX + 0.2, 0.18, 0.14]} position={[0, top - 0.09, -spanZ / 2]} color={C.kayuDark} />
        <Box size={[spanX + 0.2, 0.18, 0.14]} position={[0, top - 0.09, spanZ / 2]} color={C.kayuDark} />
        <Box size={[0.14, 0.18, spanZ + 0.2]} position={[-spanX / 2, top - 0.27, 0]} color={C.kayuDark} />
        <Box size={[0.14, 0.18, spanZ + 0.2]} position={[spanX / 2, top - 0.27, 0]} color={C.kayuDark} />

        {/* pengaku diagonal (skur) — rekomendasi mitigasi */}
        {(flags.mitigationApplied || flags.showMitigation) &&
          cols
            .filter(([x, z]) => Math.abs(Math.abs(x) - spanX / 2) < 0.01 || Math.abs(Math.abs(z) - spanZ / 2) < 0.01)
            .flatMap(([x, z], i) => {
              const out: React.ReactNode[] = [];
              const onX = Math.abs(Math.abs(z) - spanZ / 2) < 0.01; // kolom di sisi depan/belakang
              const len = 0.75;
              const y = top - 0.18 - (len / Math.SQRT2) / 2;
              if (onX) {
                [-1, 1].forEach((dir) => {
                  if (Math.abs(x + dir * 0.4) > spanX / 2 + 0.01) return;
                  out.push(
                    <Box key={`bx${i}${dir}`} size={[len, 0.07, 0.07]} position={[x + dir * (len / Math.SQRT2) / 2, y, z]} rotation={[0, 0, dir * (Math.PI / 4)]} color={flags.mitigationApplied ? C.brace : C.angkur} opacity={flags.mitigationApplied ? 1 : 0.6} />
                  );
                });
              }
              return out;
            })}

        {/* dinding */}
        {!isJineng && (
          <group position={[0, ph, 0]}>
            {s.walls.back && <Wall length={spanX + 0.15} height={wallH} position={[0, 0, -spanZ / 2]} rotationY={0} color={wallColor} reinforced={reinforced} />}
            {s.walls.front && <Wall length={spanX + 0.15} height={wallH} position={[0, 0, spanZ / 2]} rotationY={0} color={wallColor} door reinforced={reinforced} />}
            {s.walls.left && <Wall length={spanZ + 0.15} height={wallH} position={[-spanX / 2, 0, 0]} rotationY={Math.PI / 2} color={wallColor} reinforced={reinforced} />}
            {s.walls.right && <Wall length={spanZ + 0.15} height={wallH} position={[spanX / 2, 0, 0]} rotationY={Math.PI / 2} color={wallColor} reinforced={reinforced} />}
          </group>
        )}

        {/* jineng: jelepih + lantai panggung + ruang simpan */}
        {isJineng && (
          <group>
            {cols.map(([x, z], i) => (
              <mesh key={i} position={[x, top - 0.35, z]}>
                <cylinderGeometry args={[0.24, 0.24, 0.04, 16]} />
                <meshStandardMaterial color={C.kayuDark} />
              </mesh>
            ))}
            <Box size={[bw * 0.95, 0.12, bd * 0.95]} position={[0, top - 0.24, 0]} color={C.kayu} />
            <Box size={[bw * 0.75, 0.55, bd * 0.75]} position={[0, top + 0.1, 0]} color={C.kayu} />
            <Box size={[0.5, 0.45, 0.03]} position={[0, top + 0.1, (bd * 0.75) / 2 + 0.02]} color={C.kayuDark} />
          </group>
        )}

        {/* atap */}
        <group position={[0, roofBase + roofLift, 0]}>
          {s.roofType === "limasan" && <Roof kind="hip" W={b.W} D={b.D} rise={rise} color={roofColor} mode={flags.roofMode} />}
          {s.roofType === "pelana" && (
            <Roof kind="gable" W={b.W} D={b.D} rise={rise} color={roofColor} mode={flags.roofMode} gableColor={C.bata} gableInset={s.overhang} />
          )}
          {s.roofType === "jineng" && (
            <Roof kind="gableZ" W={b.W} D={b.D} rise={rise} color={roofColor} mode={flags.roofMode} gableColor={C.kayu} gableInset={s.overhang * 0.6} />
          )}
        </group>
      </group>
    );
  }

  return (
    <group position={[b.center.x, 0, b.center.z]}>
      <group ref={tiltRef}>
        <group
          rotation={[0, b.phi, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(b.id);
          }}
        >
          {content}
          {(selected || (flags.showMitigation && report)) && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
              <planeGeometry args={[b.W + 0.3, b.D + 0.3]} />
              <meshBasicMaterial
                color={selected ? "#3b82f6" : RISK_COLOR[report!.level]}
                transparent
                opacity={selected ? 0.45 : 0.35}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      </group>
      {flags.showLabels && (
        <Html position={[0, b.height + 0.6, 0]} center distanceFactor={22} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-medium shadow">
            {s.name.split(" (")[0]}
            {flags.showMitigation && report && (
              <span className="ml-1 font-semibold" style={{ color: RISK_COLOR[report.level] }}>
                • {report.level}
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
