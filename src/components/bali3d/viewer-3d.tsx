"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Btn } from "./ui";
import { Html } from "@react-three/drei";
import { segmentPlan, type Segmentation } from "../../lib/bali3d/segmentation";
import { placeBuildings, type SpecOverrides } from "../../lib/bali3d/layout";
import { type AstaParams, type BaliOrientation, defaultGateSegment, type GateDirection, gateSegments, kajaDir } from "../../lib/bali3d/asta-rules";
import { buildAstaSegmentation, checkCompliance, DEFAULT_SIZE, landExtents, type LandShape, withGate } from "../../lib/bali3d/asta-layout";
import { analyzeSite, type CheckStatus, DEFAULT_PARAMS, type SeismicParams } from "../../lib/bali3d/seismic";
import { BUILDING_SPECS, type BuildingSpec, type RoofMaterial, type WallMaterial } from "../../lib/bali3d/specs";
import { BaliBuilding, type RoofMode, type ViewFlags } from "./building-mesh";
import { AssemblyMarker, CollapseZone, EvacuationRoutes, Ground, Penyengker, SafeArea } from "./site-mesh";
import { GroundMotion, ShakeProvider, type ShakeState } from "./shake";
import type { PlacedBuilding } from "../../lib/bali3d/layout";
import { CATALOG, CATALOG_BY_ID, DEFAULT_ENTRY } from "../../lib/bali3d/catalog";
import { ShrineModel, shrineHeight } from "./shrines";
import { BuildingDims, LandDimensions, RuleDistanceLines } from "./dimensions";
import type { BuildingType, DetectedBuilding } from "../../lib/bali3d/segmentation";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

type CamPreset = "atas" | "depan" | "samping" | "perspektif";

/** gambar tampak depan dataset yang dipakai sebagai pembanding per tipe bangunan */
const ELEV_REF: Partial<Record<string, string>> = {
  bale_daja: "Meten Sakutus",
  bale_dangin: "Sakaroras",
  bale_dauh: "Sakenem Masaka Pandak",
  bale_delod: "Sakepat",
  jineng: "Jineng",
  angkul_angkul: "Kori",
  merajan: "Gedong V1",
  penunggun_karang: "Kemulan V1",
};

/**
 * Fitur mitigasi gempa (peta zona runtuh, titik kumpul, jalur evakuasi, perkuatan,
 * simulasi guncangan, cek per bangunan) disembunyikan dulu. Kode tetap ada di
 * lib/bali3d/seismic.ts & komponen terkait — ubah ke true untuk mengaktifkan lagi.
 */
const ENABLE_GEMPA = false;

const STATUS_STYLE: Record<CheckStatus, string> = {
  ok: "bg-green-100 text-green-800",
  warn: "bg-amber-100 text-amber-800",
  bad: "bg-red-100 text-red-800",
};
const STATUS_LABEL: Record<CheckStatus, string> = { ok: "Aman", warn: "Perhatian", bad: "Rawan" };
const LEVEL_STYLE = { Rendah: "text-green-700", Sedang: "text-amber-700", Tinggi: "text-red-700" };

/** Skala Intensitas -> nilai visual & label */
const INTENSITY = [
  { label: "Ringan (±0,1 g)", value: 0.35, freq: 2.5 },
  { label: "Sedang (±0,25 g)", value: 0.65, freq: 2.0 },
  { label: "Kuat (±0,5 g)", value: 1.0, freq: 1.6 },
];

function imageToData(img: CanvasImageSource): ImageData | null {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 256, 256);
  return ctx.getImageData(0, 0, 256, 256);
}

/** saat bangunan dipilih, kamera mendekat ke bangunan itu */
function FocusRig({ target }: { target: { x: number; z: number; h: number; front: { x: number; z: number } } | null }) {
  const { camera, controls, invalidate } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update: () => void } | null;
    invalidate: () => void;
  };
  useEffect(() => {
    if (!target) return;
    const d = Math.max(7, target.h * 2.6);
    camera.position.set(target.x + target.front.x * d + d * 0.35, target.h * 0.95 + 1.2, target.z + target.front.z * d + d * 0.35);
    if (controls) {
      controls.target.set(target.x, target.h * 0.45, target.z);
      controls.update();
    }
    invalidate();
  }, [target, camera, controls, invalidate]);
  return null;
}

function CameraRig({ preset, front, size, nonce, eyeY = 6.5, targetY }: { preset: CamPreset; front: { x: number; z: number }; size: number; nonce: number; eyeY?: number; targetY?: number }) {
  const { camera, controls, invalidate } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update: () => void } | null;
    invalidate: () => void;
  };
  useEffect(() => {
    const d = Math.max(size, 6);
    const ty = preset === "atas" ? 0 : targetY ?? (preset === "depan" || preset === "samping" ? Math.min(2, eyeY * 0.5) : 0);
    if (preset === "atas") camera.position.set(0, d * 1.55, 0.01);
    else if (preset === "depan") camera.position.set(front.x * d * 1.25, eyeY, front.z * d * 1.25);
    else if (preset === "samping") camera.position.set(front.z * d * 1.25, eyeY, -front.x * d * 1.25);
    else camera.position.set(d * 0.62, d * 0.6 + ty * 0.5, d * 0.78);
    camera.lookAt(0, ty, 0);
    if (controls) {
      controls.target.set(0, ty, 0);
      controls.update();
    }
    invalidate(); // frameloop "demand": gambar ulang sekali setelah kamera dipindah
  }, [preset, front.x, front.z, size, camera, controls, nonce, invalidate, eyeY, targetY]);
  return null;
}

function Toggle({ active, onClick, children, title, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <Btn active={active} onClick={onClick} title={title} disabled={disabled}>
      {children}
    </Btn>
  );
}

function NumberField({ label, value, step, min, max, onChange, suffix }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-600">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-24 accent-gray-900"
        />
        <span className="w-14 text-right tabular-nums">
          {value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}
          {suffix}
        </span>
      </span>
    </label>
  );
}

/** kompas: utara & kaja */
function Compass({ land, kaja }: { land: { x: number; z: number }[]; kaja: { x: number; z: number } }) {
  if (!land.length) return null;
  const minZ = Math.min(...land.map((p) => p.z));
  const maxZ = Math.max(...land.map((p) => p.z));
  const maxX = Math.max(...land.map((p) => p.x));
  const kz = kaja.z < 0 ? minZ - 3.4 : maxZ + 3.4;
  return (
    <>
      <Html position={[maxX + 2.2, 0.2, minZ - 1.2]} center style={{ pointerEvents: "none" }}>
        <div className="rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 shadow">▲ U</div>
      </Html>
      <Html position={[0, 0.2, kz]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded bg-amber-100/95 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 shadow">
          KAJA (gunung)
        </div>
      </Html>
    </>
  );
}

const DEFAULT_ASTA: AstaParams = {
  footLength: 26,
  sideFootLength: 10,
  landLength: 18,
  landWidth: 14,
  gateDirection: "Selatan",
  orientation: "Bali Selatan",
};

/** form parameter lahan (sama dengan form Generate / Building Layout) — 3D bisa dibuat tanpa GAN */
function AstaForm({ value, onSubmit, compact }: { value: AstaParams; onSubmit: (p: AstaParams) => void; compact?: boolean }) {
  const [v, setV] = useState<AstaParams>(value);
  useEffect(() => setV(value), [value]);
  const num = (k: keyof AstaParams, label: string, step = 1) => (
    <label className="flex flex-col gap-0.5 text-[11px] text-gray-600">
      {label}
      <input
        type="number"
        step={step}
        value={v[k] as number}
        onChange={(e) => setV({ ...v, [k]: parseFloat(e.target.value) || 0 })}
        className="h-7 rounded border px-1.5 text-xs text-gray-900"
      />
    </label>
  );
  const invalid =
    (v.landLength < 6 && v.landWidth < 7) || (v.landLength < 7 && v.landWidth < 6) || v.landLength === v.landWidth;
  return (
    <form
      className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) onSubmit(v);
      }}
    >
      {num("footLength", "Panjang telapak kaki (cm)")}
      {num("sideFootLength", "Lebar telapak kaki (cm)")}
      {num("landLength", "Panjang lahan (m)", 0.5)}
      {num("landWidth", "Lebar lahan (m)", 0.5)}
      <label className="flex flex-col gap-0.5 text-[11px] text-gray-600">
        Arah gerbang (jalan)
        <select className="h-7 rounded border px-1 text-xs text-gray-900" value={v.gateDirection} onChange={(e) => setV({ ...v, gateDirection: e.target.value as GateDirection })}>
          {["Utara", "Timur", "Selatan", "Barat"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-[11px] text-gray-600">
        Orientasi
        <select className="h-7 rounded border px-1 text-xs text-gray-900" value={v.orientation} onChange={(e) => setV({ ...v, orientation: e.target.value as BaliOrientation })}>
          <option>Bali Selatan</option>
          <option>Bali Utara</option>
        </select>
      </label>
      <div className="col-span-full flex items-center justify-between gap-2">
        <span className="text-[11px] text-red-600">{invalid ? "Lahan minimal 6×7 m dan tidak boleh persegi." : ""}</span>
        <Btn active type="submit" disabled={invalid}>
          Buat 3D
        </Btn>
      </div>
    </form>
  );
}

export default function Viewer3D({
  image,
  footLength,
  asta: astaProp,
  landShape,
  allowGan = true,
}: {
  image?: CanvasImageSource;
  footLength: number;
  /** input form (Asta Kosala Kosali). Bila ada, mode "Aturan" & cek kesesuaian aktif */
  asta?: AstaParams;
  /** bentuk lahan yang digambar pengguna (x = timur, z = selatan; satuan bebas) */
  landShape?: LandShape;
  /** false: hanya mode aturan dari input (tanpa denah GAN / unggah gambar) */
  allowGan?: boolean;
}) {
  // tanpa GAN: langsung tampilkan 3D dengan parameter contoh, bisa diubah di panel
  const [localAsta, setLocalAsta] = useState<AstaParams | null>(allowGan ? null : DEFAULT_ASTA);
  useEffect(() => {
    if (astaProp) setLocalAsta(null);
  }, [astaProp]);
  const asta = localAsta ?? astaProp;
  const [showForm, setShowForm] = useState(!allowGan);
  const [uploaded, setUploaded] = useState<HTMLImageElement | null>(null);
  const [overrides, setOverrides] = useState<SpecOverrides>({});
  const [params, setParams] = useState<SeismicParams>(DEFAULT_PARAMS);
  const [roofMode, setRoofMode] = useState<RoofMode>("solid");
  const [showMitigation, setShowMitigation] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [preset, setPreset] = useState<CamPreset>("atas");
  const [camNonce, setCamNonce] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [intensityIdx, setIntensityIdx] = useState(1);
  const [shaking, setShaking] = useState(false);
  const [shadowsOn, setShadowsOn] = useState(false);
  const [showDims, setShowDims] = useState(true);
  const [showOrn, setShowOrn] = useState(true);
  // mode bangunan tunggal: satu bangunan, detail penuh (untuk dilihat satu per satu)
  const [viewMode, setViewMode] = useState<"kompleks" | "tunggal">("kompleks");
  const [singleType, setSingleType] = useState<BuildingType>("bale_daja");
  const [singleSize, setSingleSize] = useState<{ P: number; L: number }>({ P: 6, L: 3.6 });
  const [singleId, setSingleId] = useState<string>("meten-sakutus");
  const [shrineH, setShrineH] = useState<number>(3.3);
  const entry = CATALOG_BY_ID[singleId];
  const pickEntry = (id: string) => {
    const e = CATALOG_BY_ID[id];
    if (!e) return;
    setSingleId(id);
    setSingleType(e.base ?? "merajan");
    setSingleSize({ P: e.P, L: e.L });
    if (e.shrine) setShrineH(e.shrine.H);
    setOverrides((o) => {
      const n = { ...o };
      delete n[`${e.base ?? "merajan"}-tunggal`];
      return n;
    });
  };
  const exportRef = useRef<THREE.Group>(null);
  const [showDist, setShowDist] = useState(false);
  const shakeRef = useRef<ShakeState>({ active: false, start: 0, duration: 12, intensity: 0, freq: 2 });

  const source = uploaded ?? image;
  const [layoutMode, setLayoutMode] = useState<"gan" | "aturan">(source ? "gan" : "aturan");
  const [gateSeg, setGateSeg] = useState(() => (asta ? defaultGateSegment(asta.gateDirection) : 3));
  useEffect(() => {
    if (asta) setGateSeg(defaultGateSegment(asta.gateDirection));
  }, [asta?.gateDirection]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLayoutMode(source ? "gan" : "aturan");
  }, [source]);

  const segGan: Segmentation | null = useMemo(() => {
    if (!source) return null;
    const data = imageToData(source);
    return data ? segmentPlan(data, footLength) : null;
  }, [source, footLength]);

  const mode = layoutMode === "aturan" && asta ? "aturan" : segGan ? "gan" : asta ? "aturan" : "gan";
  // penyusunan tata letak dijalankan setelah UI sempat menggambar (tidak mengunci halaman)
  const [seg, setSeg] = useState<Segmentation | null>(null);
  const [computing, setComputing] = useState(false);
  useEffect(() => {
    if (mode === "aturan" && asta) {
      setComputing(true);
      const id = window.setTimeout(() => {
        setSeg(buildAstaSegmentation(asta, null, gateSeg, landShape));
        setComputing(false);
      }, 30);
      return () => window.clearTimeout(id);
    }
    setSeg(segGan && asta ? withGate(segGan, asta, gateSeg) : segGan);
    setComputing(false);
  }, [mode, asta, segGan, gateSeg, landShape]);

  const tunggal = viewMode === "tunggal";
  const singleSeg: Segmentation = useMemo(() => {
    const { P, L } = singleSize;
    const b: DetectedBuilding = {
      id: `${singleType}-tunggal`,
      type: singleType,
      center: { x: 0, z: 0 },
      axisU: { x: 1, z: 0 },
      axisV: { x: 0, z: 1 },
      lenU: P,
      lenV: L,
      areaM2: P * L,
      pixelCount: 0,
    };
    const hw = P / 2 + 2.5;
    const hd = L / 2 + 2.5;
    return {
      metersPerPixel: 0,
      land: [
        { x: -hw, z: -hd },
        { x: hw, z: -hd },
        { x: hw, z: hd },
        { x: -hw, z: hd },
      ],
      landAreaM2: 4 * hw * hd,
      buildings: [b],
      width: 0,
      height: 0,
    };
  }, [singleType, singleSize]);
  const activeSeg = tunggal ? singleSeg : seg;
  const shrineMode = tunggal && entry?.kind === "shrine";
  const shrineP = shrineMode && entry?.shrine ? { ...entry.shrine, W: singleSize.P, H: shrineH } : null;
  const buildings = useMemo(() => {
    if (!activeSeg) return [];
    if (tunggal && entry?.spec) {
      const id = `${singleType}-tunggal`;
      return placeBuildings(activeSeg, { ...overrides, [id]: { ...entry.spec, ...(overrides[id] ?? {}) } });
    }
    return placeBuildings(activeSeg, overrides);
  }, [activeSeg, overrides, tunggal, entry, singleType]);
  const shrineFake = shrineP
    ? ({ id: "shrine", center: { x: 0, z: 0 }, phi: 0, W: shrineP.W, D: shrineP.W, height: shrineHeight(shrineP) } as unknown as PlacedBuilding)
    : null;
  const site = useMemo(
    () => (ENABLE_GEMPA && seg ? analyzeSite(seg, buildings, params) : null),
    [seg, buildings, params]
  );

  useEffect(() => setSelected(null), [seg]);
  const compliance = useMemo(
    () => (asta && seg ? checkCompliance(buildings, seg.land, asta, gateSeg) : null),
    [asta, seg, buildings, gateSeg]
  );

  const gate = buildings.find((b) => b.type === "angkul_angkul");
  const front = gate ? gate.front : { x: 0, z: 1 };
  const tunggalH = shrineP ? shrineHeight(shrineP) : buildings[0]?.height ?? 4;
  const siteSize = shrineP
    ? Math.max(shrineP.W * 2.5, shrineHeight(shrineP) * 1.25) * 1.7
    : tunggal
    ? Math.max(singleSize.P, singleSize.L, (buildings[0]?.height ?? 4) * 1.2) * 1.7
    : seg && seg.land.length
    ? Math.max(...seg.land.map((p) => Math.hypot(p.x, p.z))) * 2
    : 30;

  const flags: ViewFlags = {
    roofMode,
    showMitigation,
    mitigationApplied: params.mitigationApplied,
    showDims: showDims && !tunggal,
    showLabels: showLabels && !tunggal,
    ornaments: tunggal || showOrn,
  };

  const sel = shrineMode ? null : tunggal ? buildings[0] ?? null : buildings.find((b) => b.id === selected) ?? null;
  const focusTarget = useMemo(
    () => (sel && !tunggal ? { x: sel.center.x, z: sel.center.z, h: sel.height, front: sel.front } : null),
    [sel?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const selReport = site?.buildings.find((r) => r.id === sel?.id) ?? null;

  const exportGLB = () => {
    const obj = exportRef.current;
    if (!obj) return;
    new GLTFExporter().parse(
      obj,
      (res) => {
        const blob = new Blob([res as ArrayBuffer], { type: "model/gltf-binary" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${tunggal ? singleId : "rumah-bali"}.glb`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      (err) => console.error(err),
      { binary: true }
    );
  };

  const updateSpec = (patch: Partial<BuildingSpec>) => {
    if (!sel) return;
    setOverrides((o) => ({ ...o, [sel.id]: { ...(o[sel.id] ?? {}), ...patch } }));
  };

  const startShake = () => {
    const it = INTENSITY[intensityIdx];
    shakeRef.current = { active: true, start: -1, duration: 12, intensity: it.value, freq: it.freq };
    setShaking(true);
  };

  if (!source && !asta) {
    return (
      <div className="w-full rounded-md border border-dashed bg-white p-4 text-sm text-gray-600">
        <p className="mb-2 font-medium text-gray-800">Buat 3D langsung dari aturan Asta Kosala Kosali (tanpa GAN)</p>
        <AstaForm
          value={DEFAULT_ASTA}
          onSubmit={(p) => {
            setLocalAsta(p);
            setLayoutMode("aturan");
          }}
        />
        <p className="mt-4 text-xs text-gray-500">
          {landShape ? "Bentuk lahan yang kamu gambar akan dipakai. " : ""}Atau Generate denah dengan GAN, atau muat gambar denah hasil (PNG 256×256 berkode warna):
        </p>
        <input
          type="file"
          accept="image/png"
          className="mt-2 block text-xs"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const img = new Image();
            img.onload = () => setUploaded(img);
            img.src = URL.createObjectURL(f);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-white p-2 shadow-sm">
        {allowGan && (
          <>
        <span className="text-xs font-semibold text-gray-500">Tata letak</span>
        <Toggle active={mode === "gan"} disabled={!segGan} onClick={() => setLayoutMode("gan")} title="Posisi bangunan mengikuti denah hasil GAN">
          Denah GAN
        </Toggle>
        <Toggle
          active={mode === "aturan"}
          disabled={!asta}
          onClick={() => setLayoutMode("aturan")}
          title={asta ? "Posisi bangunan dihitung dari rumus jarak Asta Kosala Kosali" : "Isi form Generate dulu"}
        >
          Aturan Asta Kosala Kosali
        </Toggle>
          </>
        )}
        <span className="text-xs font-semibold text-gray-500">Mode</span>
        <Toggle
          active={!tunggal}
          onClick={() => {
            setViewMode("kompleks");
            setPreset("atas");
            setCamNonce((n) => n + 1);
          }}
        >
          Kompleks
        </Toggle>
        <Toggle
          active={tunggal}
          onClick={() => {
            if (sel) {
              pickEntry(DEFAULT_ENTRY[sel.type]);
              if (sel.type !== "merajan" && sel.type !== "penunggun_karang")
                setSingleSize({ P: +Math.max(sel.W, sel.D).toFixed(2), L: +Math.min(sel.W, sel.D).toFixed(2) });
            }
            setViewMode("tunggal");
            setPreset("perspektif");
            setCamNonce((n) => n + 1);
          }}
          title="Lihat satu bangunan dengan detail penuh"
        >
          Bangunan tunggal
        </Toggle>
        <span className="ml-2 text-xs font-semibold text-gray-500">Tampak</span>
        {(["atas", "depan", "samping", "perspektif"] as CamPreset[]).map((p) => (
          <Toggle
            key={p}
            active={preset === p}
            onClick={() => {
              setPreset(p);
              setCamNonce((n) => n + 1);
            }}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </Toggle>
        ))}
        <span className="ml-2 text-xs font-semibold text-gray-500">Atap</span>
        {(
          [
            ["solid", "Utuh"],
            ["transparent", "Tembus"],
            ["lifted", "Angkat"],
            ["hidden", "Lepas"],
          ] as [RoofMode, string][]
        ).map(([m, l]) => (
          <Toggle key={m} active={roofMode === m} onClick={() => setRoofMode(m)}>
            {l}
          </Toggle>
        ))}
        {ENABLE_GEMPA && (
          <>
        <span className="ml-2 text-xs font-semibold text-gray-500">Gempa</span>
        <Toggle active={showMitigation} onClick={() => setShowMitigation((v) => !v)} title="Zona runtuh, titik kumpul, jalur evakuasi, tingkat risiko">
          Peta mitigasi
        </Toggle>
        <Toggle
          active={params.mitigationApplied}
          onClick={() => setParams((p) => ({ ...p, mitigationApplied: !p.mitigationApplied }))}
          title="Tampilkan bangunan dengan perkuatan yang direkomendasikan"
        >
          Terapkan perkuatan
        </Toggle>
        <select
          className="h-8 rounded-md border px-2 text-xs"
          value={intensityIdx}
          onChange={(e) => setIntensityIdx(parseInt(e.target.value))}
        >
          {INTENSITY.map((it, i) => (
            <option key={i} value={i}>
              {it.label}
            </option>
          ))}
        </select>
        <Btn variant="danger" onClick={startShake} disabled={shaking}>
          {shaking ? "Mengguncang…" : "Simulasi gempa"}
        </Btn>
          </>
        )}
        <span className="ml-2 text-xs font-semibold text-gray-500">Tampilkan</span>
        <Toggle active={showLabels} onClick={() => setShowLabels((v) => !v)}>
          Label
        </Toggle>
        <Toggle active={showDims} onClick={() => setShowDims((v) => !v)} title="Panjang × lebar bangunan dan ukuran lahan">
          Ukuran
        </Toggle>
        {!tunggal && (
          <Toggle active={showOrn} onClick={() => setShowOrn((v) => !v)} title="Ornamen Bali (matikan kalau terasa berat)">
            Ornamen
          </Toggle>
        )}
        <Btn onClick={exportGLB} title="Unduh model 3D (.glb) untuk Blender / laporan">
          Unduh 3D
        </Btn>
        <Toggle active={showDist && !tunggal} disabled={!asta || tunggal} onClick={() => setShowDist((v) => !v)} title="Garis jarak aturan Asta Kosala Kosali (hijau sesuai, merah tidak)">
          Jarak
        </Toggle>
        <Toggle active={shadowsOn} onClick={() => setShadowsOn((v) => !v)} title="Bayangan lebih bagus tapi lebih berat">
          Bayangan
        </Toggle>
        {allowGan && (
        <label className="ml-auto cursor-pointer text-xs text-gray-500 underline">
          Muat denah lain
          <input
            type="file"
            accept="image/png"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const img = new Image();
              img.onload = () => setUploaded(img);
              img.src = URL.createObjectURL(f);
              e.target.value = "";
            }}
          />
        </label>
        )}
      </div>

      <div className="flex w-full flex-col gap-3 xl:flex-row">
        {/* kanvas 3D */}
        <div className="relative h-[560px] w-full overflow-hidden rounded-md bg-gradient-to-b from-sky-200 to-sky-50 shadow-sm xl:flex-1">
          <Canvas
            shadows={shadowsOn}
            frameloop={shaking ? "always" : "demand"}
            dpr={[1, 1.5]}
            camera={{ fov: 40, near: 0.1, far: 500, position: [0, 50, 0.01] }}
            onPointerMissed={() => setSelected(null)}
          >
            <ShakeProvider value={shakeRef}>
              <ambientLight intensity={0.55} />
              <hemisphereLight args={["#e0f2fe", "#6b8f47", 0.35]} />
              <directionalLight
                position={[18, 30, 12]}
                intensity={1.3}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-camera-left={-30}
                shadow-camera-right={30}
                shadow-camera-top={30}
                shadow-camera-bottom={-30}
              />
              <GroundMotion onEnd={() => setShaking(false)}>
                {activeSeg && <Ground land={activeSeg.land} />}
                {!tunggal && seg && <Compass land={seg.land} kaja={kajaDir(asta?.orientation ?? "Bali Selatan")} />}
                {!tunggal && seg && showDims && <LandDimensions land={seg.land} />}
                {!tunggal && seg && showDist && asta && <RuleDistanceLines buildings={buildings} land={seg.land} asta={asta} />}
                {tunggal && showDims && (shrineFake ? <BuildingDims b={shrineFake} /> : buildings[0] && <BuildingDims b={buildings[0]} />)}
                <group ref={exportRef}>
                {!tunggal && seg && <Penyengker land={seg.land} gate={gate} reinforced={params.mitigationApplied} ornate={flags.ornaments} />}
                {shrineP && <ShrineModel {...shrineP} />}
                {!shrineP && buildings.map((b) => (
                  <BaliBuilding
                    key={b.id}
                    b={b}
                    report={site?.buildings.find((r) => r.id === b.id)}
                    flags={flags}
                    selected={!tunggal && selected === b.id}
                    onSelect={tunggal ? () => {} : setSelected}
                  />
                ))}
                </group>
                {showMitigation && site && (
                  <>
                    {buildings
                      .map((b) => (
                        <CollapseZone key={b.id} b={b} radius={site.buildings.find((r) => r.id === b.id)!.collapseRadius} />
                      ))}
                    <SafeArea cells={site.safeCells} size={site.cellSize} />
                    <EvacuationRoutes routes={site.routes} />
                    {site.assemblyPoint && <AssemblyMarker p={site.assemblyPoint} safe={site.assemblyMargin >= 0} />}
                  </>
                )}
              </GroundMotion>
              <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
              <CameraRig
                preset={preset}
                front={tunggal ? buildings[0]?.front ?? { x: 0, z: 1 } : front}
                size={siteSize}
                nonce={camNonce}
                eyeY={tunggal ? Math.max(1.6, tunggalH * 0.55) : 6.5}
                targetY={tunggal ? tunggalH * 0.45 : undefined}
              />
              <FocusRig target={focusTarget} />
            </ShakeProvider>
          </Canvas>
          {computing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 text-sm font-medium text-gray-700">
              Menyusun tata letak…
            </div>
          )}
          {showMitigation && (
            <div className="absolute bottom-2 left-2 space-y-0.5 rounded bg-white/90 p-2 text-[11px] shadow">
              <div><span className="mr-1 inline-block h-2 w-3 bg-red-400/60" />Zona runtuh ({params.collapseFactor}× tinggi)</div>
              <div><span className="mr-1 inline-block h-2 w-3 bg-green-600/50" />Area aman titik kumpul</div>
              <div><span className="mr-1 inline-block h-0.5 w-3 bg-green-500 align-middle" />Jalur ke titik kumpul</div>
              <div><span className="mr-1 inline-block h-0.5 w-3 bg-sky-500 align-middle" />Titik kumpul → luar</div>
              <div><span className="mr-1 inline-block h-2 w-2 bg-red-600" />Angkur/skur yang perlu dicek</div>
            </div>
          )}
          <div className="absolute right-2 top-2 rounded bg-white/80 px-2 py-1 text-[11px] text-gray-600">
            Klik bangunan untuk detail • seret untuk memutar
          </div>
        </div>

        {/* panel samping */}
        <div className="flex w-full flex-col gap-3 xl:w-[400px]">
          {tunggal && (
            <div className="rounded-md bg-white p-3 text-sm shadow-sm">
              <p className="font-semibold">Bangunan tunggal</p>
              <p className="text-xs text-gray-500">Satu bangunan dengan ornamen penuh. Ukuran = garis atap (seperti denah 2D).</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="col-span-2 flex flex-col gap-0.5 text-[11px] text-gray-600">
                  Tipe bangunan
                  <select className="h-7 rounded border px-1 text-xs text-gray-900" value={singleId} onChange={(e) => pickEntry(e.target.value)}>
                    {(["Hunian", "Suci"] as const).map((g) => (
                      <optgroup key={g} label={g === "Hunian" ? "Bangunan tempat tinggal" : "Bangunan tempat suci"}>
                        {CATALOG.filter((c) => c.group === g).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                {shrineMode && (
                  <>
                    <label className="flex flex-col gap-0.5 text-[11px] text-gray-600">
                      Lebar alas (m)
                      <input type="number" step={0.05} min={0.4} value={singleSize.P} onChange={(e) => setSingleSize((v) => ({ ...v, P: Math.max(0.4, parseFloat(e.target.value) || 0.4) }))} className="h-7 rounded border px-1.5 text-xs text-gray-900" />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[11px] text-gray-600">
                      Tinggi (m)
                      <input type="number" step={0.05} min={1} value={shrineH} onChange={(e) => setShrineH(Math.max(1, parseFloat(e.target.value) || 1))} className="h-7 rounded border px-1.5 text-xs text-gray-900" />
                    </label>
                  </>
                )}
                {!shrineMode && (["P", "L"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-0.5 text-[11px] text-gray-600">
                    {k === "P" ? "Panjang (m)" : "Lebar (m)"}
                    <input
                      type="number"
                      step={0.1}
                      min={0.6}
                      value={singleSize[k]}
                      onChange={(e) => setSingleSize((v) => ({ ...v, [k]: Math.max(0.6, parseFloat(e.target.value) || 0.6) }))}
                      className="h-7 rounded border px-1.5 text-xs text-gray-900"
                    />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                {entry?.note && <span className="block text-gray-600">Dari gambar: {entry.note}</span>}
                Tips: klik bangunan di mode Kompleks lalu pilih &quot;Bangunan tunggal&quot; untuk memakai ukurannya. Tampak Depan/Samping untuk elevasi, &quot;Unduh 3D&quot; untuk file .glb.
              </p>
              {entry?.source && (
                <figure className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/elevations/catalog/${entry.id}.jpg`}
                    alt={`Tampak depan ${entry.name}`}
                    className="w-full rounded border bg-white"
                    onError={(e) => ((e.target as HTMLImageElement).parentElement!.style.display = "none")}
                  />
                  <figcaption className="mt-0.5 text-[10px] leading-snug text-gray-400">
                    Pembanding: {entry.name} — Traditional Balinese Building Architecture Dataset (Mendeley Data, DOI 10.17632/h7hxgwydzj, CC BY 4.0).
                  </figcaption>
                </figure>
              )}
            </div>
          )}
          {!sel && !tunggal && (
            <div className="rounded-md bg-white p-3 text-sm shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Parameter lahan</p>
                <button className="text-xs text-blue-600 underline" onClick={() => setShowForm((x) => !x)}>
                  {showForm ? "tutup" : "ubah"}
                </button>
              </div>
              {asta && !showForm && (
                <p className="text-xs text-gray-500">
                  {asta.landLength} × {asta.landWidth} m • gerbang {asta.gateDirection} • {asta.orientation} • telapak {asta.footLength}/{asta.sideFootLength} cm
                  {localAsta && astaProp ? " (diubah di sini)" : ""}
                </p>
              )}
              {(showForm || !asta) && (
                <div className="mt-2">
                  <AstaForm
                    compact
                    value={asta ?? DEFAULT_ASTA}
                    onSubmit={(p) => {
                      setLocalAsta(p);
                      setLayoutMode("aturan");
                      if (allowGan) setShowForm(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {compliance && asta && !sel && !tunggal && (
            <div className="rounded-md bg-white p-3 text-sm shadow-sm">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold">Kesesuaian Asta Kosala Kosali</p>
                <span className="text-xs text-gray-500">
                  Tier {compliance.tier} • {compliance.okCount}/{compliance.rows.length} sesuai
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {mode === "gan" ? "Jarak di denah GAN" : "Jarak hasil penyusunan aturan"} dibanding rumus tabel (tepi ke tepi,
                toleransi ±10%). {asta.orientation}: kaja = {asta.orientation === "Bali Selatan" ? "utara" : "selatan"}.
              </p>
              <table className="mt-2 w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="font-medium">Jarak</th>
                    <th className="text-right font-medium">Aturan</th>
                    <th className="text-right font-medium">3D</th>
                    <th className="text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-0.5">
                        {r.label} <span className="text-gray-400">({r.sideKey})</span>
                      </td>
                      <td className="text-right tabular-nums">{r.target.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{r.actual === null ? "–" : r.actual.toFixed(2)}</td>
                      <td
                        className={`pl-1 text-right font-semibold ${
                          r.status === "sesuai" ? "text-green-700" : r.status === "tidak" ? "text-red-600" : "text-gray-400"
                        }`}
                      >
                        {r.status === "sesuai" ? "✓" : r.status === "tidak" ? "✗" : "?"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-600">Angkul-angkul (sisi {asta.gateDirection}, 1/9 sisi)</span>
                <select className="h-7 rounded border px-1" value={gateSeg} onChange={(e) => setGateSeg(parseInt(e.target.value))}>
                  {gateSegments(asta.gateDirection).map((g) => (
                    <option key={g.index} value={g.index}>
                      {g.index}. {g.bhsBali} {g.good ? "(baik)" : "(kurang baik)"}
                    </option>
                  ))}
                </select>
              </label>
              <p className={`mt-1 text-xs ${compliance.gate.good ? "text-green-700" : "text-red-600"}`}>
                Segmen {compliance.gate.segment}: {compliance.gate.name} — {compliance.gate.meaning}
              </p>
              {mode === "aturan" && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Lahan {landExtents(asta).ew.toFixed(1)} m (timur–barat) × {landExtents(asta).ns.toFixed(1)} m (utara–selatan); lebar
                  lahan dianggap sisi yang menghadap jalan. Merajan, Bale Daja & Penunggun Karang dikunci di posisi aturan,
                  bangunan lain disusun sedekat mungkin dengan aturan tanpa bertumpuk.
                </p>
              )}
              {seg?.notes?.map((n, i) => (
                <p key={i} className="mt-1 text-[11px] text-amber-700">
                  {n}
                </p>
              ))}
              {compliance.rows.some((r) => r.status === "tidak") && mode === "aturan" && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Jarak bertanda ✗ tidak bisa dipenuhi bersamaan di ukuran lahan ini (jumlah jarak aturan + ukuran bangunan &gt; panjang lahan).
                </p>
              )}
            </div>
          )}
          {sel ? (
            <div className="rounded-md bg-white p-3 text-sm shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{sel.spec.name}</p>
                  <p className="text-xs text-gray-500">{sel.spec.description}</p>
                </div>
                {!tunggal && (
                  <button className="text-xs text-gray-400" onClick={() => setSelected(null)}>
                    tutup
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <span>Garis atap</span>
                <span className="text-right">{sel.W.toFixed(2)} × {sel.D.toFixed(2)} m</span>
                <span>Badan/bebaturan</span>
                <span className="text-right">{sel.bodyW.toFixed(2)} × {sel.bodyD.toFixed(2)} m</span>
                <span>Tinggi total</span>
                <span className="text-right">{sel.height.toFixed(2)} m</span>
                <span>Saka</span>
                <span className="text-right">{sel.spec.sakaCount}</span>
                {selReport && (
                  <>
                <span>Berat seismik (W)</span>
                <span className="text-right">{selReport.weightKN.toFixed(1)} kN</span>
                <span>Gaya geser dasar (V)</span>
                <span className="text-right">{selReport.baseShearKN.toFixed(1)} kN{sel.spec.sakaCount > 0 && ` (${selReport.shearPerSakaKN.toFixed(2)}/saka)`}</span>
                <span>Periode getar (T)</span>
                <span className="text-right">{selReport.periodS.toFixed(2)} s</span>
                <span>Tingkat risiko</span>
                <span className={`text-right font-semibold ${LEVEL_STYLE[selReport.level]}`}>{selReport.level}</span>
                  </>
                )}
              </div>

              <p className="mt-3 text-xs font-semibold text-gray-500">Parameter tampak depan</p>
              <div className="mt-1 space-y-1">
                <NumberField label="Tinggi bebaturan" value={sel.spec.plinthHeight} step={0.05} min={0.1} max={1.5} suffix=" m" onChange={(v) => updateSpec({ plinthHeight: v })} />
                <NumberField label="Tinggi saka" value={sel.spec.sakaHeight} step={0.05} min={0.6} max={3.2} suffix=" m" onChange={(v) => updateSpec({ sakaHeight: v })} />
                <NumberField label="Kemiringan atap" value={sel.spec.roofPitchDeg} step={1} min={20} max={70} suffix="°" onChange={(v) => updateSpec({ roofPitchDeg: v })} />
                <NumberField label="Teritisan" value={sel.spec.overhang} step={0.05} min={0.1} max={1.5} suffix=" m" onChange={(v) => updateSpec({ overhang: v })} />
                <label className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Penutup atap</span>
                  <select className="h-7 rounded border px-1" value={sel.spec.roofMaterial} onChange={(e) => updateSpec({ roofMaterial: e.target.value as RoofMaterial })}>
                    <option value="alang-alang">Alang-alang</option>
                    <option value="genteng">Genteng</option>
                    <option value="ijuk">Ijuk</option>
                  </select>
                </label>
                <label className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Dinding</span>
                  <select className="h-7 rounded border px-1" value={sel.spec.wallMaterial} onChange={(e) => updateSpec({ wallMaterial: e.target.value as WallMaterial })}>
                    <option value="bata">Bata</option>
                    <option value="paras">Paras</option>
                    <option value="kayu">Kayu</option>
                    <option value="none">Tanpa dinding</option>
                  </select>
                </label>
                {overrides[sel.id] && (
                  <button
                    className="text-xs text-blue-600 underline"
                    onClick={() =>
                      setOverrides((o) => {
                        const n = { ...o };
                        delete n[sel.id];
                        return n;
                      })
                    }
                  >
                    Kembalikan ke default ({BUILDING_SPECS[sel.type].name})
                  </button>
                )}
              </div>
              {/* gambar tampak depan dari dataset sebagai pembanding */}
              {!tunggal && ELEV_REF[sel.type] && (
                <figure className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/elevations/${sel.type}.jpg`}
                    alt={`Tampak depan ${ELEV_REF[sel.type]}`}
                    className="w-full rounded border bg-white"
                    onError={(e) => ((e.target as HTMLImageElement).parentElement!.style.display = "none")}
                  />
                  <figcaption className="mt-0.5 text-[10px] leading-snug text-gray-400">
                    Pembanding: tampak depan {ELEV_REF[sel.type]} — Traditional Balinese Building Architecture Dataset
                    (Mendeley Data, DOI 10.17632/h7hxgwydzj, CC BY 4.0).
                  </figcaption>
                </figure>
              )}

              {selReport && (
                <>
              <p className="mt-3 text-xs font-semibold text-gray-500">Cek mitigasi gempa</p>
              <ul className="mt-1 space-y-1.5">
                {selReport.checks.map((c) => (
                  <li key={c.id} className="text-xs">
                    <span className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    <span className="font-medium">{c.label}.</span> {c.detail}
                    {c.recommendation && <p className="mt-0.5 pl-1 text-gray-600">→ {c.recommendation}</p>}
                  </li>
                ))}
              </ul>
                </>
              )}
            </div>
          ) : (
            site &&
            seg && (
              <div className="rounded-md bg-white p-3 text-sm shadow-sm">
                <p className="font-semibold">Ringkasan mitigasi gempa</p>
                <p className="text-xs text-gray-500">
                  Lahan ±{seg.landAreaM2.toFixed(0)} m² • {buildings.length} bangunan terdeteksi dari denah
                </p>
                <table className="mt-2 w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="font-medium">Bangunan</th>
                      <th className="text-right font-medium">Tinggi</th>
                      <th className="text-right font-medium">V (kN)</th>
                      <th className="text-right font-medium">Risiko</th>
                    </tr>
                  </thead>
                  <tbody>
                    {site.buildings.map((r) => (
                      <tr key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(r.id)}>
                        <td className="py-0.5">{r.name.split(" (")[0]}</td>
                        <td className="text-right">{r.height.toFixed(1)} m</td>
                        <td className="text-right">{r.baseShearKN.toFixed(1)}</td>
                        <td className={`text-right font-semibold ${LEVEL_STYLE[r.level]}`}>{r.level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="mt-3 space-y-1.5">
                  {site.siteChecks.map((c) => (
                    <li key={c.id} className="text-xs">
                      <span className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                      <span className="font-medium">{c.label}.</span> {c.detail}
                      {c.recommendation && <p className="mt-0.5 pl-1 text-gray-600">→ {c.recommendation}</p>}
                    </li>
                  ))}
                </ul>
                {site.routes.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    Jalur evakuasi:{" "}
                    {site.routes.map((r) => `${r.from.split(" (")[0]} ${r.reachable ? r.length.toFixed(1) + " m" : "terhalang"}`).join(" • ")}
                  </div>
                )}
              </div>
            )
          )}

          {ENABLE_GEMPA && (
          <div className="rounded-md bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-gray-500">Parameter gempa</p>
            <div className="space-y-1">
              <NumberField label="SDS (g)" value={params.sds} step={0.05} min={0.2} max={1.5} onChange={(v) => setParams((p) => ({ ...p, sds: v }))} />
              <NumberField label="Faktor R" value={params.R} step={0.5} min={1} max={6} onChange={(v) => setParams((p) => ({ ...p, R: v }))} />
              <NumberField label="Zona runtuh" value={params.collapseFactor} step={0.1} min={0.3} max={1.5} suffix="×H" onChange={(v) => setParams((p) => ({ ...p, collapseFactor: v }))} />
              <NumberField label="Penghuni" value={params.occupants} step={1} min={1} max={30} onChange={(v) => setParams((p) => ({ ...p, occupants: v }))} />
            </div>
            <p className="mt-2 text-[10px] leading-snug text-gray-400">
              Estimasi tingkat perencanaan (V = SDS·Ie/R · W, T ≈ 0,0488·h^0,75 pola SNI 1726:2019). Cek SDS lokasi di
              aplikasi Spektra Indonesia (PUSKIM PUPR). Bukan pengganti perhitungan struktur oleh ahli.
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
