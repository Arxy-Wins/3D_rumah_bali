/**
 * Aturan Asta Kosala Kosali yang sama dengan:
 *  - bali-building-plan-design/src/components/distance-table.tsx (RULES + getSouthTier)
 *  - bali-building-simulator-api/models/BaliLocationOfDoor.js (filosofi 9 segmen pintu pekarangan)
 * Jarak = (pengali × footLength + sideFootLength) / 100 meter, diukur tepi ke tepi
 * (sesuai panah pada gambar tata letak di API: tataUtara/tataSelatan/...).
 */
import type { BuildingType } from "./segmentation";

export type Tier = "S1" | "S2" | "S3";
export type GateDirection = "Utara" | "Timur" | "Selatan" | "Barat";
export type BaliOrientation = "Bali Utara" | "Bali Selatan";

export interface AstaParams {
  footLength: number; // cm
  sideFootLength: number; // cm
  landLength: number; // m
  landWidth: number; // m
  gateDirection: GateDirection;
  orientation: BaliOrientation;
}

export function getTier(landLength: number, landWidth: number): Tier {
  const L = Math.max(landLength, landWidth);
  const W = Math.min(landLength, landWidth);
  if (L >= 7 && W >= 6 && L < 11 && W < 10) return "S1";
  if (L >= 11 && W >= 10 && L < 13 && W < 12) return "S2";
  return "S3";
}

export type RuleTarget = BuildingType | "tembok_kaja" | "sudut_kaja_kauh";

export interface DistanceRule {
  id: string;
  label: string;
  sideKey: string;
  a: BuildingType;
  b: RuleTarget;
  multipliers: Record<Tier, number>;
}

/** urutan & pengali identik dengan RULES di distance-table.tsx */
export const DISTANCE_RULES: DistanceRule[] = [
  { id: "guru", label: "Merajan – Bale Daja", sideKey: "Guru", a: "merajan", b: "bale_daja", multipliers: { S1: 3, S2: 11, S3: 19 } },
  { id: "rudra", label: "Bale Daja – Bale Kelod", sideKey: "Rudra", a: "bale_daja", b: "bale_delod", multipliers: { S1: 5, S2: 13, S3: 21 } },
  { id: "sri-kauh-kangin", label: "Bale Kauh – Bale Kangin", sideKey: "Sri", a: "bale_dauh", b: "bale_dangin", multipliers: { S1: 9, S2: 17, S3: 25 } },
  { id: "brahma", label: "Bale Daja – Dapur", sideKey: "Brahma", a: "bale_daja", b: "paon", multipliers: { S1: 22, S2: 30, S3: 38 } },
  { id: "sri-jineng", label: "Bale Daja – Jineng", sideKey: "Sri", a: "bale_daja", b: "jineng", multipliers: { S1: 25, S2: 33, S3: 41 } },
  { id: "kala-dauh", label: "Bale Dauh – Bale Daja", sideKey: "Kala", a: "bale_dauh", b: "bale_daja", multipliers: { S1: 15, S2: 23, S3: 31 } },
  { id: "uma", label: "Bale Daja – Tembok", sideKey: "Uma", a: "bale_daja", b: "tembok_kaja", multipliers: { S1: 8, S2: 16, S3: 24 } },
  { id: "kala-penunggun", label: "Penunggun Karang – Tembok", sideKey: "Kala", a: "penunggun_karang", b: "sudut_kaja_kauh", multipliers: { S1: 7, S2: 15, S3: 23 } },
  { id: "indra", label: "Bale Daja – Bale Dangin", sideKey: "Indra", a: "bale_daja", b: "bale_dangin", multipliers: { S1: 10, S2: 18, S3: 26 } },
];

export function ruleDistance(rule: DistanceRule, p: AstaParams, tier = getTier(p.landLength, p.landWidth)) {
  return (rule.multipliers[tier] * p.footLength + p.sideFootLength) / 100;
}

export function ruleDistances(p: AstaParams): Record<string, number> {
  const tier = getTier(p.landLength, p.landWidth);
  return Object.fromEntries(DISTANCE_RULES.map((r) => [r.id, ruleDistance(r, p, tier)]));
}

// ---------- pintu pekarangan (angkul-angkul) ----------

export interface GateSegment {
  index: number; // 1..9
  bhsBali: string;
  bhsIndonesia: string;
  good: boolean;
}

/** disalin dari BaliLocationOfDoor.getPhilosophy */
const PHILOSOPHY: Record<GateDirection, [string, string, boolean][]> = {
  Utara: [
    ["Karogan", "boros", false],
    ["Tan Panak", "tidak punya keturunan", false],
    ["Nohan", "miskin", false],
    ["Kadalih", "sering difitnah", false],
    ["Kebrahman", "panas", false],
    ["Brahma Stana", "panas", false],
    ["Suka Mageng", "sangat bahagia", true],
    ["Bagya Sih", "dicintai kebahagiaan", true],
    ["Kageringan", "sakit", false],
  ],
  Timur: [
    ["Teka Sih Prih", "kesedihan", false],
    ["Kinabhakten", "kesetiaan", true],
    ["Werdhi Guna", "berkembang", true],
    ["Dana Teka", "datang rezeki", true],
    ["Kabrahman", "panas", false],
    ["Dana Werdhi", "rezeki berkembang", true],
    ["Nohan", "miskin", false],
    ["Stri Jahat", "istri jahat", false],
    ["Nista", "rendah", false],
  ],
  Selatan: [
    ["Bhaya Agung", "bahaya besar", false],
    ["Tan Panak", "tidak punya keturunan", false],
    ["Suka Mageng", "sangat bahagia", true],
    ["Uudan Mas", "hujan emas", false],
    ["Brahma Stana", "panas", false],
    ["Dana Werdhi", "rezeki berkembang", true],
    ["Sugih Bhaya", "kaya tapi berbahaya", false],
    ["Teka Werdhi", "datang kemakmuran", true],
    ["Kapaten", "kematian", false],
  ],
  Barat: [
    ["Bhaya Agung", "bahaya besar", false],
    ["Musuh Makweh", "banyak musuh", false],
    ["Werdhi Mas", "emas berkembang", true],
    ["Werdhi Guna", "berkembang", true],
    ["Dhanawan", "kaya", false],
    ["Brahma Stana", "panas", false],
    ["Kinabhakten", "kesetiaan", true],
    ["Piutangan", "berutang", false],
    ["Karogo Kala", "sakit", false],
  ],
};

export function gateSegments(dir: GateDirection): GateSegment[] {
  return PHILOSOPHY[dir].map(([bhsBali, bhsIndonesia, good], i) => ({ index: i + 1, bhsBali, bhsIndonesia, good }));
}

/** segmen baik pertama (sama dengan contoh gambar tata letak di API) */
export function defaultGateSegment(dir: GateDirection) {
  return gateSegments(dir).find((s) => s.good)!.index;
}

/**
 * Posisi pusat segmen ke-k (0..1 sepanjang sisi) dengan arah penomoran API:
 * Utara: barat→timur, Timur: utara→selatan, Selatan: timur→barat, Barat: selatan→utara.
 * Mengembalikan t dalam koordinat dunia (x = timur, z = selatan) dari sisi kiri/atas.
 */
export function gateSegmentT(dir: GateDirection, k: number) {
  const c = (k - 0.5) / 9;
  switch (dir) {
    case "Utara":
      return { axis: "x" as const, t: c }; // dari barat
    case "Timur":
      return { axis: "z" as const, t: c }; // dari utara
    case "Selatan":
      return { axis: "x" as const, t: 1 - c }; // dari timur → diubah ke dari barat
    case "Barat":
      return { axis: "z" as const, t: 1 - c }; // dari selatan → diubah ke dari utara
  }
}

/** arah kaja (menuju gunung) di koordinat dunia; Bali Selatan = utara, Bali Utara = selatan */
export function kajaDir(o: BaliOrientation) {
  return o === "Bali Selatan" ? { x: 0, z: -1 } : { x: 0, z: 1 };
}

export const GATE_OUTWARD: Record<GateDirection, { x: number; z: number }> = {
  Utara: { x: 0, z: -1 },
  Timur: { x: 1, z: 0 },
  Selatan: { x: 0, z: 1 },
  Barat: { x: -1, z: 0 },
};
