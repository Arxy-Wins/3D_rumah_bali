"use client";

/**
 * ORNAMEN BALI (versi parametrik)
 * --------------------------------
 * Semua ornamen dibuat dari bentuk dasar dan ukurannya mengikuti ukuran bangunan,
 * jadi panjang × lebar × tinggi bangunan tidak berubah. Ornamen hanya "ditempel"
 * di titik-titik tertentu:
 *   - Pepalihan   : profil bertingkat bebaturan (kaki – pelipit – badan – pelipit – kepala)
 *   - Patra       : pita ukiran pada badan bebaturan, dinding, dan panel atas pintu
 *                   (pola sulur buatan sendiri, digambar dengan canvas)
 *   - Canggahwang : siku/penyangga berukir di kepala saka
 *   - Murdha      : mahkota di puncak atap
 *   - Ikut celedu : ujung bubungan yang melengkung ke atas
 *   - Kori        : pintu kayu dengan bingkai prada (emas)
 *
 * Bentuk & proporsi masih perkiraan umum; untuk detail yang akurat, isi
 * data/katalog-ornamen.csv dan sesuaikan parameter di file ini.
 */
import React, { useMemo } from "react";
import * as THREE from "three";

export const ORN = {
  paras: "#c4bba9",
  parasDark: "#8f8676",
  parasLight: "#d9d1c0",
  prada: "#c9a03a",
  kayu: "#7b4a28",
  kayuDark: "#4e2c16",
  terracotta: "#9a4a2a",
  ijuk: "#2e2925",
};

// ---------- tekstur patra (pola sulur, dapat diulang horizontal) ----------
let patraCanvas: HTMLCanvasElement | null = null;
function getPatraCanvas() {
  if (patraCanvas || typeof document === "undefined") return patraCanvas;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = ORN.paras;
  g.fillRect(0, 0, 256, 96);
  // garis tepi atas & bawah
  g.fillStyle = ORN.parasDark;
  g.fillRect(0, 0, 256, 7);
  g.fillRect(0, 89, 256, 7);
  g.strokeStyle = "#5e5244";
  g.lineCap = "round";
  // dua sulur per ubin (tileable: motif berada di dalam ubin)
  for (const ox of [0, 128]) {
    const cx = ox + 64;
    const cy = 48;
    g.lineWidth = 5;
    // batang bergelombang
    g.beginPath();
    g.moveTo(ox, cy + 14);
    g.bezierCurveTo(ox + 30, cy + 30, ox + 50, cy - 26, cx, cy - 6);
    g.bezierCurveTo(ox + 80, cy + 16, ox + 100, cy + 30, ox + 128, cy + 14);
    g.stroke();
    // spiral (punggel)
    g.lineWidth = 4;
    g.beginPath();
    for (let t = 0; t < Math.PI * 3.2; t += 0.12) {
      const r = 20 - t * 1.8;
      const x = cx + Math.cos(t + Math.PI) * r;
      const y = cy - 6 + Math.sin(t + Math.PI) * r * 0.85;
      if (t === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    // daun
    g.lineWidth = 3;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 22, cy + 10);
      g.quadraticCurveTo(cx + s * 40, cy - 22, cx + s * 54, cy - 6);
      g.quadraticCurveTo(cx + s * 40, cy + 2, cx + s * 22, cy + 10);
      g.stroke();
    }
    // bunga kecil
    g.fillStyle = "#5e5244";
    g.beginPath();
    g.arc(ox + 4, cy + 14, 4, 0, Math.PI * 2);
    g.fill();
  }
  patraCanvas = c;
  return c;
}

const patraCache = new Map<string, THREE.MeshStandardMaterial>();
/** material patra dengan pengulangan sesuai panjang (± satu motif per 0,6 m) */
export function patraMaterial(lengthM: number, tint?: string) {
  const rep = Math.max(1, Math.round(lengthM / 0.6));
  const key = `${rep}|${tint ?? ""}`;
  let m = patraCache.get(key);
  if (!m) {
    const canvas = getPatraCanvas();
    if (!canvas) return new THREE.MeshStandardMaterial({ color: ORN.paras });
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(rep, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, color: tint ?? "#ffffff" });
    patraCache.set(key, m);
  }
  return m;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, metal = false) {
  const k = color + metal;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.35 : 0.85, metalness: metal ? 0.6 : 0 });
    matCache.set(k, m);
  }
  return m;
}
const UNIT = new THREE.BoxGeometry(1, 1, 1);

function B({
  s,
  p,
  c,
  r,
  material,
}: {
  s: [number, number, number];
  p: [number, number, number];
  c?: string;
  r?: [number, number, number];
  material?: THREE.Material;
}) {
  return <mesh geometry={UNIT} scale={s} position={p} rotation={r} material={material ?? mat(c ?? ORN.paras)} castShadow receiveShadow />;
}

/** pita patra di keempat sisi sebuah balok (dipakai di badan bebaturan) */
function PatraSides({ w, d, h, y }: { w: number; d: number; h: number; y: number }) {
  const t = 0.012;
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={UNIT} scale={[w, h, t]} position={[0, 0, d / 2 + t / 2]} material={patraMaterial(w)} />
      <mesh geometry={UNIT} scale={[w, h, t]} position={[0, 0, -d / 2 - t / 2]} material={patraMaterial(w)} />
      <mesh geometry={UNIT} scale={[t, h, d]} position={[w / 2 + t / 2, 0, 0]} material={patraMaterial(d)} />
      <mesh geometry={UNIT} scale={[t, h, d]} position={[-w / 2 - t / 2, 0, 0]} material={patraMaterial(d)} />
    </group>
  );
}

/** bebaturan berprofil pepalihan: kaki – pelipit – badan (berpatra) – pelipit – kepala */
export function PepalihanPlinth({ w, d, h }: { w: number; d: number; h: number }) {
  const parts: [number, number, string][] = [
    // [tinggi relatif, tambahan lebar, warna]
    [0.22, 0.16, ORN.parasDark],
    [0.07, 0.08, ORN.parasLight],
    [0.42, 0, ORN.paras],
    [0.07, 0.08, ORN.parasLight],
    [0.22, 0.14, ORN.paras],
  ];
  let y = 0;
  return (
    <group>
      {parts.map(([fh, add, c], i) => {
        const hh = fh * h;
        const el = (
          <group key={i}>
            <B s={[w + add, hh, d + add]} p={[0, y + hh / 2, 0]} c={c} />
            {i === 2 && h >= 0.35 && <PatraSides w={w} d={d} h={hh * 0.8} y={y + hh / 2} />}
          </group>
        );
        y += hh;
        return el;
      })}
    </group>
  );
}

/** canggahwang: dua siku berukir di kepala saka, mengarah ke balok */
export function Canggahwang({ top, dirs }: { top: number; dirs: [number, number][] }) {
  const L = 0.42;
  return (
    <group>
      {dirs.map(([dx, dz], i) => {
        const ang = Math.atan2(dx, dz);
        return (
          <group key={i} position={[0, top - 0.32, 0]} rotation={[0, ang, 0]}>
            <B s={[0.07, 0.1, L]} p={[0, 0.1, L / 2 - 0.02]} r={[Math.PI / 5, 0, 0]} c={ORN.kayu} />
            <B s={[0.09, 0.06, 0.1]} p={[0, 0.24, L - 0.07]} c={ORN.prada} material={mat(ORN.prada, true)} />
          </group>
        );
      })}
    </group>
  );
}

/** murdha: mahkota puncak atap (dasar – leher – kerucut – mustika prada) */
export function Murdha({ s, y, x = 0, z = 0, color = ORN.terracotta }: { s: number; y: number; x?: number; z?: number; color?: string }) {
  return (
    <group position={[x, y, z]}>
      <B s={[s, s * 0.25, s]} p={[0, s * 0.12, 0]} c={color} />
      <mesh position={[0, s * 0.42, 0]} material={mat(color)} castShadow>
        <cylinderGeometry args={[s * 0.28, s * 0.4, s * 0.35, 8]} />
      </mesh>
      <mesh position={[0, s * 0.95, 0]} material={mat(color)} castShadow>
        <coneGeometry args={[s * 0.3, s * 0.75, 8]} />
      </mesh>
      <mesh position={[0, s * 1.4, 0]} material={mat(ORN.prada, true)}>
        <sphereGeometry args={[s * 0.12, 12, 8]} />
      </mesh>
    </group>
  );
}

/** ikut celedu: ujung bubungan melengkung ke atas, menghadap ke luar */
export function IkutCeledu({ at, dir, s, color = ORN.ijuk }: { at: [number, number, number]; dir: [number, number]; s: number; color?: string }) {
  const geo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(s * 0.55, 0.02, 0),
      new THREE.Vector3(s * 0.75, s * 0.55, 0)
    );
    return new THREE.TubeGeometry(curve, 12, Math.max(0.035, s * 0.07), 6, false);
  }, [s]);
  const ang = Math.atan2(-dir[1], dir[0]);
  return <mesh geometry={geo} position={at} rotation={[0, ang, 0]} material={mat(color)} castShadow />;
}

/** bubungan: balok penutup di sepanjang bubungan */
export function RidgeCap({ from, to, s, color = ORN.ijuk }: { from: [number, number, number]; to: [number, number, number]; s: number; color?: string }) {
  const len = Math.hypot(to[0] - from[0], to[2] - from[2]);
  if (len < 0.05) return null;
  const ang = Math.atan2(to[2] - from[2], to[0] - from[0]);
  return (
    <B
      s={[len + 0.1, s * 0.18, s * 0.22]}
      p={[(from[0] + to[0]) / 2, from[1] + s * 0.05, (from[2] + to[2]) / 2]}
      r={[0, -ang, 0]}
      c={color}
    />
  );
}

/** ornamen atap sesuai bentuk atap */
export function RoofOrnaments({
  kind,
  W,
  D,
  rise,
  roofColor,
}: {
  kind: "hip" | "gable" | "gableZ" | "pyramid";
  W: number;
  D: number;
  rise: number;
  roofColor: string;
}) {
  const s = Math.max(0.18, Math.min(0.55, Math.min(W, D) * 0.13));
  const capColor = roofColor === ORN.ijuk ? "#1c1916" : ORN.ijuk;
  if (kind === "pyramid" || (kind === "hip" && Math.abs(W - D) < 0.05)) {
    return <Murdha s={s * 1.1} y={rise - 0.02} />;
  }
  let a: [number, number, number];
  let b: [number, number, number];
  if (kind === "hip") {
    const r = Math.abs(W - D) / 2;
    if (W >= D) {
      a = [-r, rise, 0];
      b = [r, rise, 0];
    } else {
      a = [0, rise, -r];
      b = [0, rise, r];
    }
  } else if (kind === "gable") {
    a = [-W / 2, rise, 0];
    b = [W / 2, rise, 0];
  } else {
    a = [0, rise, -D / 2];
    b = [0, rise, D / 2];
  }
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const l = Math.hypot(dx, dz) || 1;
  const u: [number, number] = [dx / l, dz / l];
  return (
    <group>
      <RidgeCap from={a} to={b} s={s} color={capColor} />
      <IkutCeledu at={b} dir={u} s={s} color={capColor} />
      <IkutCeledu at={a} dir={[-u[0], -u[1]]} s={s} color={capColor} />
      <Murdha s={s} y={rise + s * 0.08} />
    </group>
  );
}

/** pita patra di bagian atas dinding (di bawah balok) */
export function WallBand({ length, height, t }: { length: number; height: number; t: number }) {
  const h = Math.min(0.3, height * 0.14);
  return (
    <group position={[0, height - h / 2 - 0.02, 0]}>
      <mesh geometry={UNIT} scale={[length, h, t + 0.025]} material={patraMaterial(length)} />
    </group>
  );
}

/** kori: bingkai prada + panel patra di atas pintu */
export function KoriFrame({ doorW, doorH, wallH, t }: { doorW: number; doorH: number; wallH: number; t: number }) {
  const f = 0.07;
  const gold = mat(ORN.prada, true);
  const panelH = Math.min(0.45, wallH - doorH - 0.05);
  return (
    <group>
      <B s={[f, doorH, t + 0.05]} p={[-doorW / 2 - f / 2, doorH / 2, 0]} material={gold} />
      <B s={[f, doorH, t + 0.05]} p={[doorW / 2 + f / 2, doorH / 2, 0]} material={gold} />
      <B s={[doorW + 2 * f, f, t + 0.05]} p={[0, doorH + f / 2, 0]} material={gold} />
      {panelH > 0.12 && (
        <mesh geometry={UNIT} scale={[doorW + 2 * f, panelH, t + 0.04]} position={[0, doorH + f + panelH / 2, 0]} material={patraMaterial(doorW, "#e8d9a8")} />
      )}
      {/* daun pintu berukir */}
      <mesh geometry={UNIT} scale={[doorW * 0.96, doorH * 0.96, 0.03]} position={[0, doorH / 2, t / 2 + 0.035]} material={patraMaterial(doorW * 0.5, "#8a5a30")} />
    </group>
  );
}
