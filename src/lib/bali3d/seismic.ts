/**
 * ANALISIS MITIGASI GEMPA (tingkat perencanaan tapak, bukan analisis struktur)
 *
 * Yang dihitung:
 *  1. Per bangunan: cek bentuk denah, bobot atap, dinding, sambungan saka–sendi,
 *     pengaku, kelangsingan, jarak ke bangunan lain (benturan/pounding), dan
 *     estimasi gaya geser dasar V = Cs·W dengan Cs = SDS·Ie/R (pola SNI 1726:2019).
 *  2. Tapak: zona runtuh tiap bangunan, area aman titik kumpul di natah,
 *     kapasitas titik kumpul, jalur evakuasi (A*) dari pintu tiap bangunan
 *     ke titik kumpul dan ke luar lewat angkul-angkul.
 *
 * Semua angka adalah estimasi kasar untuk edukasi/perencanaan awal. Desain
 * struktur sebenarnya tetap perlu dihitung oleh ahli struktur.
 */
import type { Segmentation, Vec2 } from "./segmentation";
import { distPointToRect, type PlacedBuilding, pointInPolygon, rectClearance } from "./layout";
import { roofBaseHeight, roofRise } from "./specs";

export interface SeismicParams {
  /** percepatan respons spektral periode pendek desain (g). Bali umumnya ±0,6–0,9 g untuk tanah sedang */
  sds: number;
  /** faktor modifikasi respons (struktur kayu tradisional tanpa panel geser ≈ 2–3) */
  R: number;
  /** faktor keutamaan gempa (rumah tinggal = 1,0) */
  Ie: number;
  occupants: number;
  /** radius zona runtuh = faktor × tinggi bangunan */
  collapseFactor: number;
  /** tampilkan versi bangunan dengan rekomendasi mitigasi sudah diterapkan */
  mitigationApplied: boolean;
}

export const DEFAULT_PARAMS: SeismicParams = {
  sds: 0.7,
  R: 2.5,
  Ie: 1.0,
  occupants: 6,
  collapseFactor: 0.6,
  mitigationApplied: false,
};

export type CheckStatus = "ok" | "warn" | "bad";

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  recommendation?: string;
}

export interface BuildingReport {
  id: string;
  name: string;
  height: number;
  weightKN: number;
  baseShearKN: number;
  shearPerSakaKN: number;
  periodS: number;
  collapseRadius: number;
  checks: Check[];
  score: number;
  level: "Rendah" | "Sedang" | "Tinggi";
}

export interface SiteReport {
  buildings: BuildingReport[];
  assemblyPoint: Vec2 | null;
  assemblyMargin: number;
  safeCells: Vec2[];
  safeAreaM2: number;
  capacity: number;
  gateExit: Vec2 | null;
  routes: { from: string; points: Vec2[]; length: number; reachable: boolean }[];
  siteChecks: Check[];
  cellSize: number;
}

// beban mati (kN/m²) — PPPURG 1987 / SNI 1727 sebagai acuan kasar
const ROOF_DL: Record<string, number> = { "alang-alang": 0.35, genteng: 0.5, ijuk: 0.3 };
const WALL_DL: Record<string, number> = { bata: 2.5, paras: 2.2, kayu: 0.4, none: 0 };
const FRAME_DL = 0.25; // rangka kayu + lantai panggung (per m² denah)

function buildingWeight(b: PlacedBuilding) {
  const s = b.spec;
  const pitch = (s.roofPitchDeg * Math.PI) / 180;
  const roofArea = (b.W * b.D) / Math.max(Math.cos(pitch), 0.3);
  const wallLen =
    (s.walls.back ? b.bodyW : 0) +
    (s.walls.front ? b.bodyW : 0) +
    (s.walls.left ? b.bodyD : 0) +
    (s.walls.right ? b.bodyD : 0);
  // setengah tinggi dinding dianggap ikut bergetar dengan atap
  const wallArea = wallLen * s.sakaHeight * 0.5;
  return roofArea * ROOF_DL[s.roofMaterial] + wallArea * WALL_DL[s.wallMaterial] + b.bodyW * b.bodyD * FRAME_DL;
}

function scoreLevel(score: number): BuildingReport["level"] {
  if (score >= 5) return "Tinggi";
  if (score >= 2) return "Sedang";
  return "Rendah";
}

export function analyzeBuildings(buildings: PlacedBuilding[], p: SeismicParams): BuildingReport[] {
  const Cs = (p.sds * p.Ie) / p.R;
  return buildings.map((b) => {
    const s = b.spec;
    const checks: Check[] = [];
    const isStructure = s.roofType !== "pelinggih" && s.roofType !== "gate";

    // 1. bentuk denah
    const ratio = Math.max(b.bodyW, b.bodyD) / Math.max(Math.min(b.bodyW, b.bodyD), 0.1);
    checks.push({
      id: "ratio",
      label: "Bentuk denah",
      status: ratio <= 2.5 ? "ok" : ratio <= 3 ? "warn" : "bad",
      detail: `Rasio panjang/lebar badan ${ratio.toFixed(2)}.`,
      recommendation:
        ratio > 2.5
          ? "Denah memanjang rawan puntir; pecah jadi dua massa atau tambah saka/dinding pengaku di tengah."
          : undefined,
    });

    // 2. bobot atap
    if (isStructure) {
      const heavy = s.roofMaterial === "genteng";
      checks.push({
        id: "roof",
        label: "Bobot atap",
        status: heavy && !p.mitigationApplied ? "warn" : "ok",
        detail: `Atap ${s.roofMaterial} (≈${ROOF_DL[s.roofMaterial]} kN/m²).`,
        recommendation: heavy
          ? "Ikat tiap genteng ke reng (kawat/paku) atau pakai genteng ringan; atap berat menaikkan gaya gempa dan genteng jatuh membahayakan jalur keluar."
          : undefined,
      });
    }

    // 3. dinding
    const hasWall = Object.values(s.walls).some(Boolean);
    if (hasWall && (s.wallMaterial === "bata" || s.wallMaterial === "paras")) {
      checks.push({
        id: "wall",
        label: "Dinding pasangan",
        status: p.mitigationApplied ? "ok" : "bad",
        detail: p.mitigationApplied
          ? "Dinding diberi kolom praktis ≤3 m dan ring balok, terikat ke saka."
          : `Dinding ${s.wallMaterial} tanpa perkuatan rawan roboh keluar bidang.`,
        recommendation: p.mitigationApplied
          ? undefined
          : "Tambah kolom praktis tiap ≤3 m dan di sudut, sloof di bawah, ring balok di atas, angkur Ø10 ke saka tiap 6 lapis bata.",
      });
    }

    // 4. sambungan saka–sendi
    if (isStructure && s.sakaCount > 0) {
      checks.push({
        id: "sendi",
        label: "Saka di atas sendi",
        status: p.mitigationApplied ? "ok" : "warn",
        detail:
          "Saka berdiri di atas sendi/umpak batu sehingga bisa bergeser sedikit (mirip isolasi dasar) — ini kelebihan konstruksi tradisional.",
        recommendation: p.mitigationApplied
          ? undefined
          : "Pastikan ada pasak/purus atau angkur baja di dasar saka supaya saka tidak lepas dari sendi saat guncangan besar.",
      });
    }

    // 5. pengaku
    if (isStructure && s.sakaCount > 0) {
      const openSides = 4 - Object.values(s.walls).filter(Boolean).length;
      checks.push({
        id: "brace",
        label: "Pengaku lateral",
        status: p.mitigationApplied || openSides <= 1 ? "ok" : "warn",
        detail: `Lambang–sineb berfungsi sebagai balok keliling; ${openSides} sisi terbuka tanpa dinding.`,
        recommendation:
          p.mitigationApplied || openSides <= 1
            ? undefined
            : "Tambah skur/siku kayu diagonal di sudut saka–lambang pada sisi terbuka; sambungan pasak tetap dipertahankan agar lentur.",
      });
    }

    // 6. kelangsingan
    // tinggi titik berat massa (≈ tengah atap) dibanding lebar badan terkecil
    const hMass = roofBaseHeight(s) + 0.5 * roofRise(s, b.W, b.D);
    const slender = hMass / Math.max(Math.min(b.bodyW, b.bodyD), 0.3);
    checks.push({
      id: "slender",
      label: "Kelangsingan",
      status: slender <= 2 ? "ok" : slender <= 3 ? "warn" : "bad",
      detail: `Tinggi titik berat/lebar = ${slender.toFixed(2)} (tinggi total ${b.height.toFixed(2)} m).`,
      recommendation:
        slender > 2
          ? s.type === "jineng"
            ? "Jineng tinggi-ramping: ikat saka panggung dengan balok silang dan angkur ke sendi."
            : "Bangunan ramping mudah terguling; perlebar dasar atau angkur ke pondasi."
          : undefined,
    });

    // 7. jarak ke bangunan lain (benturan atap)
    let minClear = Infinity;
    let nearest = "";
    for (const o of buildings) {
      if (o.id === b.id) continue;
      const c = rectClearance(b.roofCorners, o.roofCorners);
      if (c < minClear) {
        minClear = c;
        nearest = o.spec.name;
      }
    }
    if (Number.isFinite(minClear)) {
      checks.push({
        id: "gap",
        label: "Jarak antar bangunan",
        status: minClear < 0.3 ? "bad" : minClear < 1 ? "warn" : "ok",
        detail: `Jarak bersih tepi atap ke ${nearest}: ${minClear.toFixed(2)} m.`,
        recommendation:
          minClear < 1
            ? "Atap terlalu dekat: saat bergoyang bisa saling membentur (pounding) dan menutup lorong. Sisakan ≥1 m antar teritisan."
            : undefined,
      });
    }

    const W = buildingWeight(b);
    const V = Cs * W;
    const periodS = 0.0488 * Math.pow(Math.max(b.height, 0.5), 0.75);
    const statusScore = { ok: 0, warn: 1, bad: 2 } as const;
    const score = checks.reduce((acc, c) => acc + statusScore[c.status], 0);
    return {
      id: b.id,
      name: s.name,
      height: b.height,
      weightKN: W,
      baseShearKN: V,
      shearPerSakaKN: s.sakaCount > 0 ? V / s.sakaCount : V,
      periodS,
      collapseRadius: p.collapseFactor * b.height,
      checks,
      score,
      level: scoreLevel(score),
    };
  });
}

// ---------- analisis tapak: grid, titik kumpul, A* ----------

interface Grid {
  x0: number;
  z0: number;
  nx: number;
  nz: number;
  cell: number;
}

function makeGrid(land: Vec2[], cell: number, pad: number): Grid {
  const xs = land.map((p) => p.x);
  const zs = land.map((p) => p.z);
  const x0 = Math.min(...xs) - pad;
  const z0 = Math.min(...zs) - pad;
  const nx = Math.ceil((Math.max(...xs) + pad - x0) / cell);
  const nz = Math.ceil((Math.max(...zs) + pad - z0) / cell);
  return { x0, z0, nx, nz, cell };
}

const cellCenter = (g: Grid, i: number, j: number): Vec2 => ({
  x: g.x0 + (i + 0.5) * g.cell,
  z: g.z0 + (j + 0.5) * g.cell,
});

function toCell(g: Grid, p: Vec2): [number, number] {
  return [
    Math.max(0, Math.min(g.nx - 1, Math.floor((p.x - g.x0) / g.cell))),
    Math.max(0, Math.min(g.nz - 1, Math.floor((p.z - g.z0) / g.cell))),
  ];
}

function astar(
  g: Grid,
  walk: Uint8Array,
  cost: Float32Array,
  start: [number, number],
  goal: [number, number]
): [number, number][] | null {
  const N = g.nx * g.nz;
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const idx = (i: number, j: number) => j * g.nx + i;
  const s = idx(...start);
  const t = idx(...goal);
  gScore[s] = 0;
  // binary heap sederhana
  const heap: [number, number][] = [[0, s]];
  const push = (item: [number, number]) => {
    heap.push(item);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const gi = goal[0];
  const gj = goal[1];
  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  while (heap.length) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    if (cur === t) break;
    closed[cur] = 1;
    const ci = cur % g.nx;
    const cj = (cur - ci) / g.nx;
    for (const [di, dj, dc] of dirs) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue;
      const n = idx(ni, nj);
      if (!walk[n] || closed[n]) continue;
      if (di !== 0 && dj !== 0 && (!walk[idx(ci + di, cj)] || !walk[idx(ci, cj + dj)])) continue;
      const tentative = gScore[cur] + dc * cost[n];
      if (tentative < gScore[n]) {
        gScore[n] = tentative;
        came[n] = cur;
        push([tentative + Math.hypot(ni - gi, nj - gj), n]);
      }
    }
  }
  if (!Number.isFinite(gScore[t])) return null;
  const path: [number, number][] = [];
  for (let c = t; c >= 0; c = came[c]) {
    path.push([c % g.nx, Math.floor(c / g.nx)]);
    if (c === s) break;
  }
  return path.reverse();
}

function simplifyPath(pts: Vec2[]): Vec2[] {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    if (Math.abs(cross) > 1e-3) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const pathLength = (pts: Vec2[]) =>
  pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0);

export function analyzeSite(seg: Segmentation, buildings: PlacedBuilding[], p: SeismicParams): SiteReport {
  const reports = analyzeBuildings(buildings, p);
  const cell = 0.25;
  const empty: SiteReport = {
    buildings: reports,
    assemblyPoint: null,
    assemblyMargin: 0,
    safeCells: [],
    safeAreaM2: 0,
    capacity: 0,
    gateExit: null,
    routes: [],
    siteChecks: [],
    cellSize: cell,
  };
  if (seg.land.length < 3) return empty;

  const g = makeGrid(seg.land, cell, 3);
  const N = g.nx * g.nz;
  const inLand = new Uint8Array(N);
  const walk = new Uint8Array(N);
  const cost = new Float32Array(N).fill(1);
  const margin = new Float32Array(N).fill(-Infinity);

  const gate = buildings.find((b) => b.type === "angkul_angkul") ?? null;
  let gateExit: Vec2 | null = null;
  if (gate) {
    gateExit = { x: gate.center.x + gate.front.x * 2.2, z: gate.center.z + gate.front.z * 2.2 };
  }

  for (let j = 0; j < g.nz; j++) {
    for (let i = 0; i < g.nx; i++) {
      const k = j * g.nx + i;
      const c = cellCenter(g, i, j);
      const inside = pointInPolygon(c, seg.land);
      inLand[k] = inside ? 1 : 0;
      let blocked = false;
      let m = Infinity;
      let inCollapse = 0;
      for (let bi = 0; bi < buildings.length; bi++) {
        const b = buildings[bi];
        // angkul-angkul tidak menghalangi jalan (ada bukaan), tapi zona runtuhnya tetap dihitung
        if (b.type !== "angkul_angkul" && distPointToRect(c, b, b.bodyW, b.bodyD) < 0.15) blocked = true;
        const dRoof = distPointToRect(c, b, b.W, b.D);
        const r = reports.find((rr) => rr.id === b.id)!.collapseRadius;
        m = Math.min(m, dRoof - r);
        if (dRoof < r) inCollapse++;
      }
      // celah gerbang: sel dekat angkul-angkul boleh dilewati walau di batas tembok
      const nearGate =
        gate && distPointToRect(c, gate, Math.max(gate.W, 1.4) + 0.4, gate.D + 4.6) < 0.01;
      walk[k] = !blocked && (inside || !!nearGate) ? 1 : 0;
      margin[k] = inside ? m : -Infinity;
      cost[k] = 1 + 6 * inCollapse;
    }
  }

  // titik kumpul: sel di lahan dengan margin terbesar dari zona runtuh
  let best = -1;
  let bestM = -Infinity;
  const safeCells: Vec2[] = [];
  for (let k = 0; k < N; k++) {
    if (!inLand[k] || !walk[k]) continue;
    if (margin[k] > bestM) {
      bestM = margin[k];
      best = k;
    }
    if (margin[k] >= 0) safeCells.push(cellCenter(g, k % g.nx, Math.floor(k / g.nx)));
  }
  const assemblyPoint = best >= 0 ? cellCenter(g, best % g.nx, Math.floor(best / g.nx)) : null;
  const safeAreaM2 = safeCells.length * cell * cell;
  const capacity = Math.floor(safeAreaM2 / 1.0); // 1 m² per orang

  const routes: SiteReport["routes"] = [];
  const target = assemblyPoint && bestM >= 0 ? assemblyPoint : gateExit;
  for (const b of buildings) {
    if (!b.spec.occupied) continue;
    if (!target) break;
    const start = toCell(g, b.door);
    const goal = toCell(g, target);
    walk[start[1] * g.nx + start[0]] = 1;
    const path = astar(g, walk, cost, start, goal);
    const pts = path ? simplifyPath(path.map(([i, j]) => cellCenter(g, i, j))) : [b.door];
    routes.push({ from: b.spec.name, points: pts, length: path ? pathLength(pts) : 0, reachable: !!path });
  }
  if (gateExit && assemblyPoint && bestM >= 0) {
    const path = astar(g, walk, cost, toCell(g, assemblyPoint), toCell(g, gateExit));
    const pts = path ? simplifyPath(path.map(([i, j]) => cellCenter(g, i, j))) : [];
    routes.push({ from: "Titik kumpul → luar", points: pts, length: path ? pathLength(pts) : 0, reachable: !!path });
  }

  const siteChecks: Check[] = [];
  siteChecks.push({
    id: "assembly",
    label: "Titik kumpul di natah",
    status: bestM >= 0 ? (capacity >= p.occupants ? "ok" : "warn") : "bad",
    detail:
      bestM >= 0
        ? `Area aman di luar zona runtuh ≈ ${safeAreaM2.toFixed(1)} m² (kapasitas ±${capacity} orang @1 m²/orang, penghuni ${p.occupants}).`
        : "Tidak ada area di natah yang bebas dari zona runtuh bangunan.",
    recommendation:
      bestM >= 0
        ? capacity >= p.occupants
          ? "Jaga natah tetap kosong (jangan diisi bangunan tambahan/pot besar)."
          : "Area aman kurang; kurangi bangunan tambahan di natah atau tetapkan titik kumpul di luar angkul-angkul."
        : "Tetapkan titik kumpul di luar pekarangan (jalan/lapangan banjar) dan pastikan angkul-angkul tidak terhalang.",
  });
  if (gate) {
    const gateR = reports.find((r) => r.id === gate.id)!;
    siteChecks.push({
      id: "gate",
      label: "Angkul-angkul sebagai jalur keluar",
      status: "warn",
      detail: `Gerbang pasangan tinggi ${gateR.height.toFixed(1)} m berada tepat di jalur keluar.`,
      recommendation:
        "Perkuat angkul-angkul dengan kolom praktis & ring balok di dalam pasangan, ikat ornamen/atapnya; jangan berlindung di bawah gerbang saat gempa.",
    });
  } else {
    siteChecks.push({
      id: "gate",
      label: "Angkul-angkul",
      status: "warn",
      detail: "Angkul-angkul tidak terdeteksi di denah.",
      recommendation: "Pastikan ada minimal satu akses keluar yang lebar ≥1,2 m.",
    });
  }
  const unreachable = routes.filter((r) => !r.reachable);
  siteChecks.push({
    id: "routes",
    label: "Jalur evakuasi",
    status: unreachable.length ? "bad" : routes.some((r) => r.length > 25) ? "warn" : "ok",
    detail: unreachable.length
      ? `${unreachable.length} bangunan tidak punya jalur bebas ke titik aman.`
      : `Jalur terpanjang ${Math.max(0, ...routes.map((r) => r.length)).toFixed(1)} m.`,
    recommendation: unreachable.length ? "Buka lorong ≥1 m di antara bangunan yang menutup jalur." : undefined,
  });
  const wallH = 1.8;
  siteChecks.push({
    id: "penyengker",
    label: "Tembok penyengker",
    status: p.mitigationApplied ? "ok" : "warn",
    detail: `Tembok keliling ±${wallH} m tanpa perkuatan bisa roboh ke jalan/lorong.`,
    recommendation: p.mitigationApplied
      ? undefined
      : "Kolom praktis tiap ≤3 m + ring balok; jangan berjalan menyusuri tembok saat evakuasi.",
  });

  return {
    buildings: reports,
    assemblyPoint,
    assemblyMargin: bestM,
    safeCells,
    safeAreaM2,
    capacity,
    gateExit,
    routes,
    siteChecks,
    cellSize: cell,
  };
}
