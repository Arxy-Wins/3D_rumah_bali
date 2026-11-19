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
 * KALIBRASI DATASET (Traditional Balinese Building Architecture Dataset, CC BY 4.0):
 *  - bale hunian (Meten, Sakenem, Sakepat, Tiang Sanga): TANPA murdha/ikut celedu,
 *    bubungan lurus; Tiang Sanga (atap limas) bermahkota kotak kecil
 *  - murdha hanya untuk bangunan suci (Gedong/pelinggih)
 *  - bebaturan Meten: pilaster di sudut & tiang + panel persegi menjorok, tinggi ±1 m
 *  - Meten: emper kecil di atas pintu, jendela persegi di dinding depan
 *  - Sakenem: sendi bulat, bale-bale di antara tiang
 *  - Kori: badan seperti candi, pilaster sayap bertingkat, motif kotak, atap limas
 * Lihat data/katalog-ornamen.csv untuk daftar & sumbernya.
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

/**
 * bebaturan: kaki – badan (pilaster + panel menjorok) – kepala, seperti tampak depan
 * Meten Sakutus di dataset. xs/zs = posisi pilaster (biasanya segaris saka).
 */
export function PepalihanPlinth({ w, d, h, xs = [], zs = [] }: { w: number; d: number; h: number; xs?: number[]; zs?: number[] }) {
  const kaki = h * 0.14;
  const kepala = h * 0.16;
  const body = h - kaki - kepala;
  const pw = Math.min(0.32, w * 0.08); // lebar pilaster
  const px = Array.from(new Set([-w / 2 + pw / 2, ...xs, w / 2 - pw / 2].map((v) => +v.toFixed(3)))).sort((a, b) => a - b);
  const pz = Array.from(new Set([-d / 2 + pw / 2, ...zs, d / 2 - pw / 2].map((v) => +v.toFixed(3)))).sort((a, b) => a - b);
  const yb = kaki + body / 2;
  const out = 0.05; // pilaster menonjol
  const panels: React.ReactNode[] = [];
  const pil: React.ReactNode[] = [];
  // sisi depan & belakang
  for (const sz of [1, -1]) {
    px.forEach((x, i) => {
      pil.push(<B key={`px${sz}${i}`} s={[pw, body, out]} p={[x, yb, sz * (d / 2 + out / 2)]} c={ORN.parasLight} />);
      if (i < px.length - 1) {
        const a = x + pw / 2;
        const b2 = px[i + 1] - pw / 2;
        const pwid = b2 - a;
        if (pwid > 0.35 && body > 0.3) {
          // bingkai + panel lebih gelap (kesan menjorok ke dalam)
          panels.push(<B key={`pf${sz}${i}`} s={[pwid - 0.12, body * 0.68, 0.012]} p={[(a + b2) / 2, yb, sz * (d / 2 + 0.006)]} c={ORN.parasDark} />);
          panels.push(<B key={`pi${sz}${i}`} s={[pwid - 0.24, body * 0.5, 0.014]} p={[(a + b2) / 2, yb, sz * (d / 2 + 0.008)]} c={ORN.paras} />);
        }
      }
    });
  }
  // sisi kiri & kanan
  for (const sx of [1, -1]) {
    pz.forEach((z, i) => {
      pil.push(<B key={`pz${sx}${i}`} s={[out, body, pw]} p={[sx * (w / 2 + out / 2), yb, z]} c={ORN.parasLight} />);
      if (i < pz.length - 1) {
        const a = z + pw / 2;
        const b2 = pz[i + 1] - pw / 2;
        const pwid = b2 - a;
        if (pwid > 0.35 && body > 0.3) {
          panels.push(<B key={`qf${sx}${i}`} s={[0.012, body * 0.68, pwid - 0.12]} p={[sx * (w / 2 + 0.006), yb, (a + b2) / 2]} c={ORN.parasDark} />);
          panels.push(<B key={`qi${sx}${i}`} s={[0.014, body * 0.5, pwid - 0.24]} p={[sx * (w / 2 + 0.008), yb, (a + b2) / 2]} c={ORN.paras} />);
        }
      }
    });
  }
  return (
    <group>
      <B s={[w + 0.18, kaki, d + 0.18]} p={[0, kaki / 2, 0]} c={ORN.parasDark} />
      <B s={[w, body, d]} p={[0, yb, 0]} c={ORN.paras} />
      {pil}
      {panels}
      <B s={[w + 0.14, kepala * 0.45, d + 0.14]} p={[0, kaki + body + kepala * 0.225, 0]} c={ORN.parasLight} />
      <B s={[w + 0.06, kepala * 0.55, d + 0.06]} p={[0, h - kepala * 0.275, 0]} c={ORN.paras} />
    </group>
  );
}

/** sendi (alas saka) berbentuk bulat seperti gambar Sakenem */
let sendiGeo: THREE.LatheGeometry | null = null;
export function Sendi({ h }: { h: number }) {
  if (!sendiGeo) {
    const pts = [
      [0.0, 0],
      [0.19, 0],
      [0.19, 0.06],
      [0.15, 0.09],
      [0.2, 0.32],
      [0.17, 0.55],
      [0.1, 0.68],
      [0.1, 1.0],
      [0.0, 1.0],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    sendiGeo = new THREE.LatheGeometry(pts, 14);
  }
  return <mesh geometry={sendiGeo} scale={[1, h, 1]} material={mat(ORN.parasDark)} castShadow />;
}

/** kepala saka (canggah) — blok kecil di bawah lambang */
export function SakaCap({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <B s={[0.24, 0.06, 0.24]} p={[0, -0.03, 0]} c={ORN.kayuDark} />
      <B s={[0.19, 0.1, 0.19]} p={[0, -0.11, 0]} c={ORN.kayu} />
    </group>
  );
}

/** bale-bale (tempat tidur/duduk kayu) di antara tiang, seperti Sakenem */
export function BaleBale({ x0, x1, z0, z1, y }: { x0: number; x1: number; z0: number; z1: number; y: number }) {
  const w = x1 - x0;
  const d = z1 - z0;
  return (
    <group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]}>
      <B s={[w, 0.07, d]} p={[0, y, 0]} c={ORN.kayu} />
      <B s={[w + 0.04, 0.09, 0.07]} p={[0, y - 0.07, d / 2]} c={ORN.kayuDark} />
      {[-1, 1].map((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} s={[0.07, y, 0.07]} p={[sx * (w / 2 - 0.05), y / 2, sz * (d / 2 - 0.05)]} c={ORN.kayuDark} />))}
    </group>
  );
}

/** emper kecil di atas pintu Meten */
export function Emper({ width, depth, y, roofColor }: { width: number; depth: number; y: number; roofColor: string }) {
  const tilt = 0.32;
  return (
    <group position={[0, y, 0]}>
      <B s={[width, 0.14, depth]} p={[0, -Math.sin(tilt) * depth * 0.5, depth / 2]} r={[tilt, 0, 0]} c={roofColor} />
      {[-1, 1].map((sx) => (
        <B key={sx} s={[0.1, y, 0.1]} p={[sx * (width / 2 - 0.12), -y / 2 - Math.sin(tilt) * depth * 0.9, depth - 0.12]} c={ORN.kayu} />
      ))}
    </group>
  );
}

/** jendela persegi kecil berbingkai (dinding Meten, motif Kori) */
export function SquareWindow({ size, depth, color = ORN.kayuDark, frame = ORN.kayu }: { size: number; depth: number; color?: string; frame?: string }) {
  return (
    <group>
      <B s={[size, size, depth]} p={[0, 0, 0]} c={frame} />
      <B s={[size * 0.62, size * 0.62, depth + 0.01]} p={[0, 0, 0]} c={color} />
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

/** ornamen atap sesuai bentuk atap. sacred=true → murdha (bangunan suci) */
export function RoofOrnaments({
  kind,
  W,
  D,
  rise,
  roofColor,
  sacred = false,
}: {
  kind: "hip" | "gable" | "gableZ" | "pyramid";
  W: number;
  D: number;
  rise: number;
  roofColor: string;
  sacred?: boolean;
}) {
  const s = Math.max(0.18, Math.min(0.55, Math.min(W, D) * 0.13));
  const capColor = roofColor === ORN.ijuk ? "#1c1916" : "#5a4526";
  const pyramid = kind === "pyramid" || (kind === "hip" && Math.abs(W - D) < 0.05);
  if (pyramid) {
    return sacred ? (
      <Murdha s={s * 1.1} y={rise - 0.02} />
    ) : (
      // mahkota kotak kecil di puncak atap limas (lihat Tiang Sanga di dataset)
      <group position={[0, rise - 0.05, 0]}>
        <B s={[s * 0.55, s * 0.5, s * 0.55]} p={[0, s * 0.25, 0]} c={capColor} />
        <B s={[s * 0.7, s * 0.08, s * 0.7]} p={[0, s * 0.52, 0]} c={capColor} />
      </group>
    );
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
      {/* bubungan lurus dengan ujung sedikit menebal (seperti gambar Meten/Sakenem) */}
      <RidgeCap from={a} to={b} s={s} color={capColor} />
      {[a, b].map((p, i) => (
        <B key={i} s={[s * 0.35, s * 0.32, s * 0.35]} p={[p[0] + (i ? 1 : -1) * u[0] * 0.05, p[1] + s * 0.12, p[2] + (i ? 1 : -1) * u[1] * 0.05]} c={capColor} />
      ))}
      {sacred && <Murdha s={s} y={rise + s * 0.08} />}
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

/**
 * Kori / angkul-angkul seperti gambar "Kori" di dataset: kaki bertingkat, badan
 * dengan lubang pintu, dua motif kotak, pilaster sayap bertingkat, kepala bertingkat,
 * atap limas dengan puncak datar. Lokal: lebar W (sumbu x), tebal D (z), depan = +z.
 */
export function KoriGate({ W, D, base, h, roofColor, showRoof }: { W: number; D: number; base: number; h: number; roofColor: string; showRoof: boolean }) {
  const bata = "#b4553a";
  const open = Math.min(1.1, W * 0.42);
  const pier = (W - open) / 2;
  const doorH = Math.min(2.2, h * 0.78);
  const headH = h - doorH;
  const y0 = base;
  const wing = (k: number, hh: number) =>
    [-1, 1].map((sx) => (
      <group key={`${k}${sx}`} position={[sx * (W / 2 + 0.14 + k * 0.24), y0, 0]}>
        <B s={[0.24, hh, D * (0.8 - k * 0.15)]} p={[0, hh / 2, 0]} c={bata} />
        <B s={[0.32, 0.1, D * (0.9 - k * 0.15)]} p={[0, hh + 0.05, 0]} c={ORN.paras} />
        <B s={[0.2, 0.14, D * (0.6 - k * 0.15)]} p={[0, hh + 0.17, 0]} c={ORN.paras} />
      </group>
    ));
  const roofW = W * 1.25;
  const roofRise = Math.max(0.6, roofW * 0.32);
  return (
    <group>
      {/* kaki bertingkat */}
      <B s={[W + 1.1, base * 0.5, D + 0.5]} p={[0, base * 0.25, 0]} c={ORN.parasDark} />
      <B s={[W + 0.7, base * 0.5, D + 0.3]} p={[0, base * 0.75, 0]} c={ORN.paras} />
      {/* badan: dua pier + kepala di atas pintu */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B s={[pier, h, D]} p={[sx * (open / 2 + pier / 2), y0 + h / 2, 0]} c={bata} />
          <group position={[sx * (open / 2 + pier / 2), y0 + doorH * 0.78, D / 2 + 0.01]}>
            <SquareWindow size={Math.min(0.32, pier * 0.6)} depth={0.03} color={ORN.parasDark} frame={ORN.paras} />
          </group>
        </group>
      ))}
      <B s={[open, headH, D]} p={[0, y0 + doorH + headH / 2, 0]} c={bata} />
      {/* lengkung kecil di sudut atas lubang pintu */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (open / 2 - 0.09), y0 + doorH - 0.09, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(bata)}>
          <cylinderGeometry args={[0.1, 0.1, D, 10, 1, false, sx > 0 ? 0 : Math.PI / 2, Math.PI / 2]} />
        </mesh>
      ))}
      {wing(0, h * 0.62)}
      {wing(1, h * 0.42)}
      {/* kepala bertingkat */}
      <B s={[W + 0.12, 0.14, D + 0.12]} p={[0, y0 + h + 0.07, 0]} c={ORN.paras} />
      <B s={[W * 0.86, 0.36, D * 0.9]} p={[0, y0 + h + 0.32, 0]} c={bata} />
      <B s={[W * 1.0, 0.12, D * 1.05]} p={[0, y0 + h + 0.56, 0]} c={ORN.paras} />
      {showRoof && (
        <group position={[0, y0 + h + 0.62, 0]}>
          <mesh geometry={pyramidFlatTop(roofW, D * 1.5, roofRise, 0.4)} material={mat(roofColor)} castShadow />
          <B s={[roofW * 0.4, 0.12, D * 1.5 * 0.4]} p={[0, roofRise + 0.06, 0]} c={ORN.paras} />
        </group>
      )}
    </group>
  );
}

/** limas terpancung (puncak datar), untuk atap kori */
function pyramidFlatTop(W: number, D: number, rise: number, topFrac: number) {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * topFrac, Math.SQRT1_2, 1, 4, 1, false);
  g.rotateY(Math.PI / 4);
  g.scale(W, rise, D);
  g.translate(0, rise / 2, 0);
  g.computeVertexNormals();
  return g;
}

/** pilaster tembok penyengker dengan mahkota bulat (seperti gambar Kori) */
let finialGeo: THREE.LatheGeometry | null = null;
export function WallPilaster({ h }: { h: number }) {
  if (!finialGeo) {
    finialGeo = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.17, 0],
        [0.2, 0.06],
        [0.12, 0.12],
        [0.18, 0.2],
        [0.08, 0.3],
        [0.08, 0.36],
        [0, 0.38],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      10
    );
  }
  return (
    <group>
      <B s={[0.34, h, 0.34]} p={[0, h / 2, 0]} c="#b0573c" />
      <B s={[0.42, 0.08, 0.42]} p={[0, h + 0.04, 0]} c={ORN.paras} />
      <mesh geometry={finialGeo} position={[0, h + 0.08, 0]} material={mat(ORN.paras)} castShadow />
    </group>
  );
}
