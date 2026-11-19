"use client";

/**
 * BANGUNAN SUCI (pelinggih) — generator parametrik dari gambar tampak depan
 * "Traditional Balinese Building Architecture Dataset" (folder Bangunan Tempat Suci).
 *
 * Susunan umum (dari bawah): tepas (alas) → kaki (pepalihan + karang di sudut) →
 * badan (batu bermotif) → rong (ruang kayu berpintu) → atap kubah ijuk (1–2 tumpang) → murdha.
 * Keluarga:
 *   gedong    : rong berpintu 1 atau 2 (kembar)
 *   kemulan   : rong tiga, karang/garuda di kiri-kanan
 *   padmasana : undakan tinggi meruncing, singgasana di puncak, tanpa atap
 *   tugu      : tiang batu bertingkat, ceruk kecil, mahkota atap kecil
 *   meru      : badan batu + atap bertingkat (tumpang 3 … 11)
 * Semua ukuran dalam meter; W = lebar alas, H = tinggi total (dari gambar dataset).
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import { curvedHipRoof } from "./roof-geometry";
import { Murdha, ORN } from "./ornaments";

export type ShrineFamily = "gedong" | "kemulan" | "padmasana" | "tugu" | "meru";

export interface ShrineParams {
  family: ShrineFamily;
  /** lebar alas (m) */
  W: number;
  /** tinggi total (m) */
  H: number;
  /** jumlah atap (gedong 1–2, meru 3–11) */
  tumpang?: number;
  /** jumlah pintu rong (gedong 1/2, kemulan 3) */
  rong?: number;
  /** bentuk badan: "diamond" (motif belah ketupat) atau "panel" */
  badan?: "diamond" | "panel";
}

const COL = {
  paras: ORN.paras,
  parasDark: ORN.parasDark,
  parasLight: ORN.parasLight,
  rong: "#7a2e1c",
  kayu: ORN.kayu,
  prada: ORN.prada,
  ijuk: ORN.ijuk,
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
function m(c: string, metal = false) {
  const k = c + metal;
  let x = mats.get(k);
  if (!x) {
    x = new THREE.MeshStandardMaterial({ color: c, roughness: metal ? 0.35 : 0.85, metalness: metal ? 0.6 : 0 });
    mats.set(k, x);
  }
  return x;
}
const U = new THREE.BoxGeometry(1, 1, 1);
function B({ s, p, c, r, metal }: { s: [number, number, number]; p: [number, number, number]; c: string; r?: [number, number, number]; metal?: boolean }) {
  return <mesh geometry={U} scale={s} position={p} rotation={r} material={m(c, metal)} castShadow receiveShadow />;
}

/** panel persegi menjorok (bingkai + isi) di keempat sisi sebuah balok */
function Panels({ w, d, h, y, inset = 0.18 }: { w: number; d: number; h: number; y: number; inset?: number }) {
  const t = 0.012;
  const out: React.ReactNode[] = [];
  for (const sz of [1, -1]) {
    out.push(<B key={`f${sz}`} s={[w * (1 - inset), h * 0.7, t]} p={[0, y, sz * (d / 2 + t / 2)]} c={COL.parasDark} />);
    out.push(<B key={`i${sz}`} s={[w * (1 - inset * 2), h * 0.5, t * 1.5]} p={[0, y, sz * (d / 2 + t)]} c={COL.paras} />);
  }
  for (const sx of [1, -1]) {
    out.push(<B key={`g${sx}`} s={[t, h * 0.7, d * (1 - inset)]} p={[sx * (w / 2 + t / 2), y, 0]} c={COL.parasDark} />);
    out.push(<B key={`j${sx}`} s={[t * 1.5, h * 0.5, d * (1 - inset * 2)]} p={[sx * (w / 2 + t), y, 0]} c={COL.paras} />);
  }
  return <>{out}</>;
}

/** motif belah ketupat (diamond) di sisi depan & belakang */
function Diamonds({ w, d, h, y }: { w: number; d: number; h: number; y: number }) {
  const sz = Math.min(w, h) * 0.38;
  return (
    <>
      {[1, -1].map((s) => (
        <group key={s} position={[0, y, s * (d / 2 + 0.01)]}>
          <B s={[sz, sz, 0.02]} p={[0, 0, 0]} r={[0, 0, Math.PI / 4]} c={COL.parasDark} />
          <B s={[sz * 0.55, sz * 0.55, 0.03]} p={[0, 0, 0]} r={[0, 0, Math.PI / 4]} c={COL.parasLight} />
        </group>
      ))}
    </>
  );
}

/**
 * karang di sudut kaki: hiasan batu menonjol di keempat sudut
 * (distilasi dari karang gajah/karang bentulu di gambar dataset)
 */
function Karang({ w, d, h, y }: { w: number; d: number; h: number; y: number }) {
  const k = Math.min(w, d) * 0.22;
  const pieces: React.ReactNode[] = [];
  for (const sx of [1, -1])
    for (const sz of [1, -1]) {
      pieces.push(
        <group key={`${sx}${sz}`} position={[sx * w / 2, y, sz * d / 2]} rotation={[0, Math.atan2(sx, sz), 0]}>
          <B s={[k * 0.9, h * 0.55, k * 0.9]} p={[0, -h * 0.15, k * 0.15]} r={[0, Math.PI / 4, 0]} c={COL.parasLight} />
          <B s={[k * 0.7, h * 0.35, k * 0.5]} p={[0, h * 0.22, k * 0.42]} r={[0.35, 0, 0]} c={COL.paras} />
          <mesh position={[0, h * 0.05, k * 0.62]} rotation={[0, 0, Math.PI / 2]} material={m(COL.parasDark)}>
            <torusGeometry args={[k * 0.22, k * 0.07, 6, 12, Math.PI * 1.5]} />
          </mesh>
        </group>
      );
    }
  return <>{pieces}</>;
}

/** rong: ruang kayu dengan tiang sudut & pintu berprada */
function Rong({ w, d, h, y, doors }: { w: number; d: number; h: number; y: number; doors: number }) {
  const post = Math.max(0.05, w * 0.07);
  const dw = (w * 0.78) / doors;
  return (
    <group position={[0, y, 0]}>
      <B s={[w * 0.92, h, d * 0.92]} p={[0, h / 2, 0]} c={COL.rong} />
      {[1, -1].map((sx) => [1, -1].map((sz) => <B key={`${sx}${sz}`} s={[post, h, post]} p={[sx * (w / 2 - post / 2), h / 2, sz * (d / 2 - post / 2)]} c={COL.kayu} />))}
      {Array.from({ length: doors }, (_, i) => {
        const x = -((doors - 1) * dw) / 2 + i * dw;
        return (
          <group key={i} position={[x, h * 0.46, d * 0.46 + 0.012]}>
            <B s={[dw * 0.78, h * 0.7, 0.025]} p={[0, 0, 0]} c={COL.prada} metal />
            <B s={[dw * 0.6, h * 0.55, 0.03]} p={[0, 0, 0]} c="#8a3a22" />
            <B s={[0.02, h * 0.55, 0.035]} p={[0, 0, 0]} c={COL.prada} metal />
          </group>
        );
      })}
      {/* kepala rong (lis atas) */}
      <B s={[w * 1.05, h * 0.08, d * 1.05]} p={[0, h + h * 0.04, 0]} c={COL.kayu} />
    </group>
  );
}

/** atap kubah ijuk */
function DomeRoof({ w, rise, y }: { w: number; rise: number; y: number }) {
  const geo = useMemo(() => curvedHipRoof(w, w, rise, "dome"), [w, rise]);
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geo} material={m(COL.ijuk)} castShadow />
      <mesh geometry={geo} position={[0, -0.08, 0]} scale={[0.97, 1, 0.97]} material={m("#1a1715")} />
    </group>
  );
}

function Gedong({ W, H, tumpang = 1, rong = 1, badan = "panel", kemulan = false }: ShrineParams & { kemulan?: boolean }) {
  // proporsi rata-rata dari gambar Gedong V1–V4, Gedong Kembar, Kemulan (tinggi relatif)
  const f = { tepas: 0.1, kaki: 0.24, badan: tumpang > 1 ? 0.12 : 0.14, rong: 0.2, roof: tumpang > 1 ? 0.24 : 0.22 };
  const tepasH = H * f.tepas;
  const kakiH = H * f.kaki;
  const badanH = H * f.badan;
  const rongH = H * f.rong;
  const roofH = H * f.roof;
  const wK = W * 0.78;
  const wB = W * (kemulan ? 0.7 : 0.56);
  const wR = W * (kemulan ? 0.85 : 0.62);
  let y = 0;
  const parts: React.ReactNode[] = [];
  // tepas (alas)
  parts.push(<B key="tp" s={[W, tepasH, W]} p={[0, tepasH / 2, 0]} c={COL.parasDark} />);
  parts.push(<Panels key="tpp" w={W} d={W} h={tepasH} y={tepasH / 2} inset={0.12} />);
  y += tepasH;
  // kaki: lis – badan kaki (karang di sudut) – lis
  parts.push(<B key="k1" s={[W * 0.9, kakiH * 0.14, W * 0.9]} p={[0, y + kakiH * 0.07, 0]} c={COL.parasLight} />);
  parts.push(<B key="k2" s={[wK, kakiH * 0.72, wK]} p={[0, y + kakiH * 0.5, 0]} c={COL.paras} />);
  parts.push(<Panels key="k2p" w={wK} d={wK} h={kakiH * 0.72} y={y + kakiH * 0.5} />);
  parts.push(<Karang key="kr" w={wK} d={wK} h={kakiH * 0.72} y={y + kakiH * 0.5} />);
  parts.push(<B key="k3" s={[W * 0.88, kakiH * 0.14, W * 0.88]} p={[0, y + kakiH * 0.93, 0]} c={COL.parasLight} />);
  y += kakiH;
  // badan batu
  parts.push(<B key="b" s={[wB, badanH, wB]} p={[0, y + badanH / 2, 0]} c={COL.paras} />);
  parts.push(badan === "diamond" ? <Diamonds key="bd" w={wB} d={wB} h={badanH} y={y + badanH / 2} /> : <Panels key="bp" w={wB} d={wB} h={badanH} y={y + badanH / 2} />);
  parts.push(<B key="bl" s={[wB * 1.25, badanH * 0.12, wB * 1.25]} p={[0, y + badanH * 0.94, 0]} c={COL.parasLight} />);
  // kemulan: karang/garuda di kiri-kanan badan atas
  if (kemulan)
    [1, -1].forEach((sx) =>
      parts.push(
        <group key={`g${sx}`} position={[sx * (wB / 2 + W * 0.08), y + badanH * 1.15, wB * 0.2]}>
          <B s={[W * 0.14, badanH * 0.9, W * 0.18]} p={[0, 0, 0]} r={[0, 0, sx * 0.25]} c={COL.parasLight} />
          <B s={[W * 0.1, badanH * 0.5, W * 0.12]} p={[sx * W * 0.03, badanH * 0.55, 0]} r={[0, 0, -sx * 0.4]} c={COL.paras} />
        </group>
      )
    );
  y += badanH;
  // rong
  parts.push(<Rong key="r" w={wR} d={wR * 0.9} h={rongH} y={y} doors={kemulan ? 3 : rong} />);
  y += rongH * 1.08;
  // atap kubah (1–2 tumpang)
  const roofW = W * (kemulan ? 1.05 : 0.98);
  if (tumpang > 1) {
    const r1 = roofH * 0.45;
    parts.push(<DomeRoof key="a1" w={roofW} rise={r1} y={y} />);
    const neck = roofH * 0.18;
    parts.push(<B key="n" s={[wR * 0.45, neck, wR * 0.45]} p={[0, y + r1 * 0.8 + neck / 2, 0]} c={COL.rong} />);
    parts.push(<DomeRoof key="a2" w={roofW * 0.7} rise={roofH * 0.37} y={y + r1 * 0.8 + neck} />);
    y += r1 * 0.8 + neck + roofH * 0.37;
  } else {
    parts.push(<DomeRoof key="a" w={roofW} rise={roofH} y={y} />);
    y += roofH;
  }
  parts.push(<Murdha key="m" s={Math.max(0.12, W * 0.16)} y={y - 0.03} color={COL.parasLight} />);
  return <group>{parts}</group>;
}

function Padmasana({ W, H }: ShrineParams) {
  // dari gambar Padmasana: alas 0,20 – 0,84 – 0,98 – 1,32 m (≈3,34 m), lebar 1,35 m
  const tiers: [number, number, string, string?][] = [
    // [lebar relatif, tinggi relatif, warna, hiasan]
    [1.0, 0.06, COL.parasDark, "panel"],
    [0.88, 0.04, COL.parasLight],
    [0.76, 0.16, COL.paras, "karang"],
    [0.86, 0.04, COL.parasLight],
    [0.6, 0.12, COL.paras, "panel"],
    [0.72, 0.03, COL.parasLight],
    [0.5, 0.18, COL.paras, "panel"],
    [0.64, 0.03, COL.parasLight],
    [0.44, 0.1, COL.paras],
    [0.56, 0.03, COL.parasLight],
  ];
  let y = 0;
  const parts: React.ReactNode[] = [];
  tiers.forEach(([fw, fh, c, deco], i) => {
    const w = W * fw;
    const h = H * fh;
    parts.push(<B key={i} s={[w, h, w]} p={[0, y + h / 2, 0]} c={c} />);
    if (deco === "panel") parts.push(<Panels key={`p${i}`} w={w} d={w} h={h} y={y + h / 2} />);
    if (deco === "karang") parts.push(<Karang key={`k${i}`} w={w} d={w} h={h} y={y + h / 2} />);
    y += h;
  });
  // singgasana: dudukan + sandaran tinggi + lengan
  const sw = W * 0.46;
  parts.push(<B key="seat" s={[sw, H * 0.04, sw]} p={[0, y + H * 0.02, 0]} c={COL.parasLight} />);
  parts.push(<B key="back" s={[sw, H * 0.18, sw * 0.18]} p={[0, y + H * 0.13, -sw * 0.41]} c={COL.paras} />);
  parts.push(<B key="backtop" s={[sw * 0.7, H * 0.05, sw * 0.2]} p={[0, y + H * 0.245, -sw * 0.41]} c={COL.prada} metal />);
  [1, -1].forEach((sx) => parts.push(<B key={`arm${sx}`} s={[sw * 0.14, H * 0.08, sw * 0.8]} p={[sx * sw * 0.43, y + H * 0.08, -sw * 0.05]} c={COL.paras} />));
  return <group>{parts}</group>;
}

function Tugu({ W, H }: ShrineParams) {
  // dari gambar Tugu (Ratu Nglurah): lebar 1,12 m, tinggi 2,90 m
  const parts: React.ReactNode[] = [];
  let y = 0;
  const add = (fw: number, fh: number, c: string, deco?: "panel" | "karang" | "diamond" | "niche") => {
    const w = W * fw;
    const h = H * fh;
    parts.push(<B key={parts.length} s={[w, h, w]} p={[0, y + h / 2, 0]} c={c} />);
    if (deco === "panel") parts.push(<Panels key={parts.length} w={w} d={w} h={h} y={y + h / 2} />);
    if (deco === "karang") parts.push(<Karang key={parts.length} w={w} d={w} h={h} y={y + h / 2} />);
    if (deco === "diamond") parts.push(<Diamonds key={parts.length} w={w} d={w} h={h} y={y + h / 2} />);
    if (deco === "niche") parts.push(<B key={parts.length} s={[w * 0.5, h * 0.62, 0.05]} p={[0, y + h * 0.48, w / 2 + 0.005]} c="#3a2a1f" />);
    y += h;
  };
  add(1.0, 0.08, COL.parasDark, "panel");
  add(0.85, 0.04, COL.parasLight);
  add(0.72, 0.16, COL.paras, "karang");
  add(0.82, 0.03, COL.parasLight);
  add(0.5, 0.18, COL.paras, "diamond");
  add(0.62, 0.03, COL.parasLight);
  add(0.46, 0.14, COL.paras, "panel");
  add(0.58, 0.03, COL.parasLight);
  add(0.42, 0.14, COL.paras, "niche");
  add(0.56, 0.03, COL.parasLight);
  // mahkota: atap kecil + murdha
  const rw = W * 0.6;
  parts.push(<DomeRoof key="roof" w={rw} rise={H * 0.08} y={y} />);
  y += H * 0.08;
  parts.push(<Murdha key="m" s={Math.max(0.1, W * 0.14)} y={y - 0.02} color={COL.parasLight} />);
  return <group>{parts}</group>;
}

function Meru({ W, H, tumpang = 3 }: ShrineParams) {
  // dari gambar Meru Tumpang Tiga (denah 2,40 m) & Tumpang Sebelas
  const n = Math.max(1, tumpang);
  const baseH = H * (n > 5 ? 0.12 : 0.22);
  const parts: React.ReactNode[] = [];
  parts.push(<B key="t" s={[W, baseH * 0.25, W]} p={[0, baseH * 0.125, 0]} c={COL.parasDark} />);
  parts.push(<B key="b" s={[W * 0.86, baseH * 0.75, W * 0.86]} p={[0, baseH * 0.25 + baseH * 0.375, 0]} c={COL.paras} />);
  parts.push(<Panels key="bp" w={W * 0.86} d={W * 0.86} h={baseH * 0.75} y={baseH * 0.625} />);
  // ruang rong di bawah atap pertama, dengan tiang sudut
  const coreY = baseH;
  const firstRoofY = baseH + H * (n > 5 ? 0.1 : 0.2);
  const post = W * 0.05;
  [1, -1].forEach((sx) =>
    [1, -1].forEach((sz) => parts.push(<B key={`p${sx}${sz}`} s={[post, firstRoofY - coreY, post]} p={[sx * W * 0.38, (coreY + firstRoofY) / 2, sz * W * 0.38]} c={COL.kayu} />))
  );
  parts.push(<Rong key="r" w={W * 0.42} d={W * 0.42} h={(firstRoofY - coreY) * 0.75} y={coreY} doors={1} />);
  // atap bertingkat mengecil
  const top = H * 0.96;
  const step = (top - firstRoofY) / n;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const rw = W * (1.25 - 0.85 * t);
    const rise = Math.max(0.2, rw * 0.22);
    const y = firstRoofY + i * step;
    parts.push(<DomeRoof key={`a${i}`} w={rw} rise={rise} y={y} />);
    if (i < n - 1) parts.push(<B key={`n${i}`} s={[rw * 0.28, step - rise * 0.6, rw * 0.28]} p={[0, y + rise * 0.6 + (step - rise * 0.6) / 2, 0]} c={COL.rong} />);
  }
  parts.push(<Murdha key="m" s={Math.max(0.12, W * 0.08)} y={firstRoofY + (n - 1) * step + Math.max(0.2, W * 0.4 * 0.22) - 0.03} color={COL.parasLight} />);
  return <group>{parts}</group>;
}

/** tinggi model (m) — dipakai untuk garis ukur */
export function shrineHeight(p: ShrineParams) {
  if (p.family === "padmasana") return p.H * 1.12;
  return p.H;
}

export function ShrineModel(p: ShrineParams) {
  switch (p.family) {
    case "kemulan":
      return <Gedong {...p} kemulan tumpang={1} />;
    case "padmasana":
      return <Padmasana {...p} />;
    case "tugu":
      return <Tugu {...p} />;
    case "meru":
      return <Meru {...p} />;
    default:
      return <Gedong {...p} />;
  }
}
