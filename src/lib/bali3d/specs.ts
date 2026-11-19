/**
 * PARAMETER TAMPAK DEPAN (ELEVASI) PER TIPE BANGUNAN
 * ---------------------------------------------------
 * Denah dari GAN hanya memberi garis luar atap (tampak atas). Tinggi, jumlah
 * saka, bentuk atap, dan dinding diambil dari tabel ini.
 *
 * Nilai default di bawah adalah perkiraan dari literatur arsitektur
 * tradisional Bali (Asta Kosala Kosali; Gelebet dkk. 1986; Raharja, "Bentuk,
 * Fungsi dan Material Bangunan Rumah Tinggal Tradisional Bali Madya").
 * Contoh: bale meten memakai 8 (sakutus) atau 12 (saka roras) saka dengan
 * bebaturan ±75–100 cm, bangunan tertinggi di pekarangan; paon memakai atap
 * pelana.
 *
 * KALIBRASI: ukur ulang dari gambar tampak depan/samping di
 * "Traditional Balinese Building Architecture Dataset" (Mendeley Data,
 * DOI 10.17632/h7hxgwydzj, CC BY 4.0), lalu ganti angkanya di sini.
 * Kalau file JPG tampak depan ditaruh di /public/elevations/<type>.jpg,
 * panel inspeksi akan menampilkannya sebagai pembanding.
 */
import type { BuildingType } from "./segmentation";

export type RoofType = "limasan" | "pelana" | "jineng" | "pelinggih" | "gate";
export type RoofMaterial = "alang-alang" | "genteng" | "ijuk";
export type WallMaterial = "bata" | "paras" | "kayu" | "none";

export interface BuildingSpec {
  type: BuildingType;
  name: string;
  description: string;
  /** jumlah saka & susunan [sepanjang bangunan, sedalam bangunan] */
  sakaCount: number;
  sakaGrid: [number, number];
  /** tinggi bebaturan (lantai) dari natah, meter */
  plinthHeight: number;
  /** tinggi saka dari lantai sampai lambang/sineb, meter */
  sakaHeight: number;
  roofType: RoofType;
  roofPitchDeg: number;
  /** teritisan atap dari badan bangunan, meter (denah = garis atap) */
  overhang: number;
  roofMaterial: RoofMaterial;
  wallMaterial: WallMaterial;
  /** dinding: belakang, kiri, kanan, depan (depan menghadap natah) */
  walls: { back: boolean; left: boolean; right: boolean; front: boolean };
  /** hunian/aktivitas (dipakai untuk prioritas evakuasi) */
  occupied: boolean;
  /** bangunan suci (piasan, pepelik, dll.): atap bermurdha */
  sacred?: boolean;
}

export const BUILDING_SPECS: Record<BuildingType, BuildingSpec> = {
  bale_daja: {
    type: "bale_daja",
    name: "Bale Daja (Bale Meten)",
    description: "Tempat tidur kepala keluarga; bebaturan paling tinggi, tertutup dinding, saka 8 (sakutus).",
    // dataset Meten Sakutus, Potongan A-A: tanah −100, lantai ±00, kaki atap ±+200, bubungan +350
    sakaCount: 8,
    sakaGrid: [4, 2],
    plinthHeight: 1.0,
    sakaHeight: 2.0,
    roofType: "limasan",
    roofPitchDeg: 40,
    overhang: 0.8,
    roofMaterial: "alang-alang",
    wallMaterial: "bata",
    walls: { back: true, left: true, right: true, front: true },
    occupied: true,
  },
  bale_dangin: {
    type: "bale_dangin",
    name: "Bale Dangin",
    description: "Bale upacara/serbaguna di timur natah; terbuka, dinding belakang saja, saka 6 (sakenem).",
    // dataset Sakaroras, Potongan A-A: tanah −60, lantai ±00, bubungan +400
    sakaCount: 6,
    sakaGrid: [3, 2],
    plinthHeight: 0.6,
    sakaHeight: 2.0,
    roofType: "limasan",
    roofPitchDeg: 45,
    overhang: 0.7,
    roofMaterial: "alang-alang",
    wallMaterial: "bata",
    walls: { back: true, left: false, right: false, front: false },
    occupied: true,
  },
  bale_dauh: {
    type: "bale_dauh",
    name: "Bale Dauh (Loji)",
    description: "Ruang tamu/tidur anak di barat natah; saka 6, dinding belakang dan samping.",
    sakaCount: 6,
    sakaGrid: [3, 2],
    plinthHeight: 0.45,
    sakaHeight: 2.1,
    roofType: "limasan",
    roofPitchDeg: 38,
    overhang: 0.7,
    roofMaterial: "alang-alang",
    wallMaterial: "bata",
    walls: { back: true, left: true, right: true, front: false },
    occupied: true,
  },
  bale_delod: {
    type: "bale_delod",
    name: "Bale Delod",
    description: "Bale di selatan natah; saka 6, dinding belakang.",
    sakaCount: 6,
    sakaGrid: [3, 2],
    plinthHeight: 0.45,
    sakaHeight: 2.0,
    roofType: "limasan",
    roofPitchDeg: 38,
    overhang: 0.6,
    roofMaterial: "alang-alang",
    wallMaterial: "bata",
    walls: { back: true, left: false, right: false, front: false },
    occupied: true,
  },
  paon: {
    type: "paon",
    name: "Paon (Dapur)",
    description: "Dapur; bebaturan rendah, dinding tiga sisi, atap pelana.",
    sakaCount: 6,
    sakaGrid: [3, 2],
    plinthHeight: 0.3,
    sakaHeight: 2.0,
    roofType: "pelana",
    roofPitchDeg: 35,
    overhang: 0.6,
    roofMaterial: "genteng",
    wallMaterial: "bata",
    walls: { back: true, left: true, right: true, front: false },
    occupied: true,
  },
  jineng: {
    type: "jineng",
    name: "Jineng (Lumbung)",
    description: "Lumbung padi panggung saka 4 dengan atap lengkung runcing; ruang bawah terbuka dengan bale-bale.",
    sakaCount: 4,
    sakaGrid: [2, 2],
    plinthHeight: 0.25,
    sakaHeight: 1.6,
    roofType: "jineng",
    roofPitchDeg: 62,
    overhang: 0.3,
    roofMaterial: "alang-alang",
    wallMaterial: "kayu",
    walls: { back: false, left: false, right: false, front: false },
    occupied: false,
  },
  merajan: {
    type: "merajan",
    name: "Merajan (Sanggah)",
    description: "Tempat suci keluarga di timur laut; berisi beberapa pelinggih dalam tembok rendah.",
    sakaCount: 4,
    sakaGrid: [2, 2],
    plinthHeight: 1.0,
    sakaHeight: 0.9,
    roofType: "pelinggih",
    roofPitchDeg: 55,
    overhang: 0.2,
    roofMaterial: "ijuk",
    wallMaterial: "paras",
    walls: { back: false, left: false, right: false, front: false },
    occupied: false,
  },
  penunggun_karang: {
    type: "penunggun_karang",
    name: "Penunggun Karang",
    description: "Pelinggih tunggal penjaga pekarangan.",
    sakaCount: 4,
    sakaGrid: [2, 2],
    plinthHeight: 1.1,
    sakaHeight: 0.8,
    roofType: "pelinggih",
    roofPitchDeg: 55,
    overhang: 0.15,
    roofMaterial: "ijuk",
    wallMaterial: "paras",
    walls: { back: false, left: false, right: false, front: false },
    occupied: false,
  },
  angkul_angkul: {
    type: "angkul_angkul",
    name: "Angkul-angkul",
    description: "Gerbang masuk pekarangan; pasangan bata/paras dengan atap kecil.",
    sakaCount: 0,
    sakaGrid: [0, 0],
    plinthHeight: 0.3,
    sakaHeight: 2.4,
    roofType: "gate",
    roofPitchDeg: 50,
    overhang: 0.2,
    roofMaterial: "genteng",
    wallMaterial: "bata",
    walls: { back: false, left: false, right: false, front: false },
    occupied: false,
  },
};

/** Tinggi bubungan atap dari lambang (meter) untuk ukuran garis atap tertentu */
export function roofRise(spec: BuildingSpec, roofW: number, roofD: number) {
  const short = Math.min(roofW, roofD);
  const t = Math.tan((spec.roofPitchDeg * Math.PI) / 180);
  if (spec.roofType === "gate") return 1.2;
  return (short / 2) * t;
}

/** Tinggi kaki atap (garis teritisan) dari natah, meter */
export function roofBaseHeight(spec: BuildingSpec) {
  // jineng: kaki atap turun sedikit melewati lantai panggung (dataset Jineng, tampak samping)
  return spec.plinthHeight + spec.sakaHeight + (spec.roofType === "jineng" ? -0.12 : 0);
}

/** Tinggi total bangunan dari natah sampai bubungan (meter) */
export function totalHeight(spec: BuildingSpec, roofW: number, roofD: number) {
  return roofBaseHeight(spec) + roofRise(spec, roofW, roofD);
}

export const ROOF_COLORS: Record<RoofMaterial, string> = {
  "alang-alang": "#a8843f",
  genteng: "#a3492c",
  ijuk: "#2e2925",
};
