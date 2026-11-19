/**
 * KATALOG SEMUA BANGUNAN DARI DATASET
 * "Traditional Balinese Building Architecture Dataset" (Mendeley Data,
 * DOI 10.17632/h7hxgwydzj, CC BY 4.0) — folder Bangunan Tempat Tinggal & Bangunan Tempat Suci.
 *
 * Tiap entri dipetakan ke generator:
 *  - kind "bale"   : bangunan bertiang (memakai BaliBuilding + override spesifikasi)
 *  - kind "shrine" : pelinggih (memakai ShrineModel: gedong/kemulan/padmasana/tugu/meru)
 * Ukuran (P × L, tinggi) diambil dari angka di gambar bila tertulis, selebihnya diperkirakan
 * dari proporsi gambar. Gambar tampak depan: /elevations/catalog/<id>.jpg
 */
import type { BuildingType } from "./segmentation";
import type { BuildingSpec } from "./specs";

export type ShrineFamily = "gedong" | "kemulan" | "padmasana" | "tugu" | "meru";

export interface CatalogEntry {
  id: string;
  name: string;
  group: "Hunian" | "Suci";
  kind: "bale" | "shrine";
  /** bale: tipe dasar + override spesifikasi tampak depan */
  base?: BuildingType;
  spec?: Partial<BuildingSpec>;
  /** shrine: parameter generator */
  shrine?: { family: ShrineFamily; H: number; tumpang?: number; rong?: number; badan?: "diamond" | "panel" };
  /** ukuran garis atap / alas (m) */
  P: number;
  L: number;
  /** file gambar dataset (relatif ke folder dataset) */
  source: string;
  note?: string;
}

const H = "Bangunan Tempat Tinggal";
const S = "Bangunan Tempat Suci";

export const CATALOG: CatalogEntry[] = [
  // ---------------- HUNIAN ----------------
  { id: "meten-sakutus", name: "Meten Sakutus", group: "Hunian", kind: "bale", base: "bale_daja", P: 6.0, L: 3.6, source: `${H}/Meten Sakutus/Tampak Depan.jpg`, note: "Potongan A-A: tanah −100, lantai ±00, bubungan +350" },
  { id: "meten-sakutus-mamben", name: "Bale Meten Sakutus Mamben", group: "Hunian", kind: "bale", base: "bale_daja", P: 5.6, L: 3.4, source: `${H}/Bale Meten Sakutus Mamben/Tampak Depan.jpg` },
  { id: "meten-gunungrata", name: "Meten Gunungrata", group: "Hunian", kind: "bale", base: "bale_daja", spec: { sakaCount: 12, sakaGrid: [4, 3] }, P: 7.0, L: 4.6, source: `${H}/Meten Gunungrata/Tampak Depan.jpg` },
  { id: "bale-meten-gunungrata", name: "Bale Meten Gunungrata", group: "Hunian", kind: "bale", base: "bale_daja", spec: { sakaCount: 12, sakaGrid: [4, 3] }, P: 6.8, L: 4.4, source: `${H}/Bale Meten Gunungrata/Tampak Depan.jpg` },
  { id: "bale-paduman", name: "Bale Paduman", group: "Hunian", kind: "bale", base: "bale_dangin", spec: { sakaCount: 8, sakaGrid: [4, 2], walls: { back: true, left: true, right: false, front: false } }, P: 5.6, L: 3.4, source: `${H}/Bale Paduman/Tampak Depan.jpg` },
  { id: "sakepat", name: "Sakepat (saka 4)", group: "Hunian", kind: "bale", base: "bale_delod", spec: { sakaCount: 4, sakaGrid: [2, 2], walls: { back: false, left: false, right: false, front: false }, plinthHeight: 0.45 }, P: 3.4, L: 2.8, source: `${H}/Sakepat/Tampak Depan.jpg` },
  { id: "sakenem", name: "Sakenem Masaka Pandak (saka 6)", group: "Hunian", kind: "bale", base: "bale_dauh", spec: { walls: { back: false, left: false, right: false, front: false }, plinthHeight: 0.4 }, P: 4.6, L: 3.0, source: `${H}/Sakenem Masaka Pandak/Tampak Depan.jpg` },
  { id: "sakaroras", name: "Sakaroras (saka 12)", group: "Hunian", kind: "bale", base: "bale_dangin", spec: { sakaCount: 12, sakaGrid: [4, 3] }, P: 6.0, L: 4.4, source: `${H}/Sakaroras/Tampak Depan.jpg`, note: "Potongan A-A: tanah −60, lantai ±00, bubungan +400" },
  { id: "sangasari", name: "Sangasari (saka 9)", group: "Hunian", kind: "bale", base: "bale_dangin", spec: { sakaCount: 9, sakaGrid: [3, 3] }, P: 4.6, L: 4.6, source: `${H}/Sangasari/Tampak Depan.jpg` },
  { id: "tiang-sanga", name: "Tiang Sanga (saka 9)", group: "Hunian", kind: "bale", base: "bale_dangin", spec: { sakaCount: 9, sakaGrid: [3, 3], walls: { back: true, left: false, right: false, front: false } }, P: 4.4, L: 4.4, source: `${H}/Tiang Sanga/Tampak Depan.jpg` },
  { id: "jineng", name: "Jineng", group: "Hunian", kind: "bale", base: "jineng", P: 2.6, L: 2.6, source: `${H}/Jineng/Tampak Depan.jpg` },
  { id: "gelebeg", name: "Gelebeg (lumbung besar)", group: "Hunian", kind: "bale", base: "jineng", spec: { sakaCount: 6, sakaGrid: [3, 2], sakaHeight: 1.8 }, P: 3.8, L: 3.0, source: `${H}/Gelebeg/Tampak Depan.jpg` },
  { id: "kelumpu", name: "Kelumpu (lumbung kecil)", group: "Hunian", kind: "bale", base: "jineng", spec: { sakaHeight: 1.3, plinthHeight: 0.2 }, P: 2.0, L: 1.8, source: `${H}/Kelumpu/Tampak Depan.jpg` },
  { id: "paon", name: "Paon (dapur) — perkiraan, tidak ada di dataset", group: "Hunian", kind: "bale", base: "paon", P: 3.6, L: 3.0, source: "" },
  { id: "kori", name: "Kori (angkul-angkul)", group: "Hunian", kind: "bale", base: "angkul_angkul", P: 2.4, L: 1.1, source: `${H}/Kori/Tampak Depan.jpg` },

  // ---------------- SUCI ----------------
  { id: "gedong-v1", name: "Gedong V1", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.6 }, P: 1.4, L: 1.4, source: `${S}/Gedong/Gedong V1/Tampak Depan.jpg` },
  { id: "gedong-v2", name: "Gedong V2", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.4 }, P: 1.2, L: 1.2, source: `${S}/Gedong/Gedong V2/Tampak Depan.png` },
  { id: "gedong-v3", name: "Gedong V3", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.3 }, P: 0.98, L: 0.98, source: `${S}/Gedong/Gedong V3/Gedong V3.png` },
  { id: "gedong-v4", name: "Gedong V4", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.18 }, P: 1.3, L: 1.3, source: `${S}/Gedong/Gedong V4/Gedong V4.png` },
  { id: "gedong-v5", name: "Gedong V5", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.0, rong: 2 }, P: 1.6, L: 1.6, source: `${S}/Gedong/Gedong V5/Tampak Depan.jpg` },
  { id: "gedong-kembar-v1", name: "Gedong Kembar V1", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 4.0, rong: 2 }, P: 1.44, L: 1.44, source: `${S}/Gedong Kembar V1/Gedong Kembar V1.png` },
  { id: "gedong-kembar-v2", name: "Gedong Kembar V2", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.3, rong: 2, badan: "panel" }, P: 0.9, L: 0.9, source: `${S}/Gedong Kembar V2/Gedong Kembar V2.png` },
  { id: "gedong-penyimpan", name: "Gedong Penyimpan", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.32 }, P: 1.12, L: 1.12, source: `${S}/Gedong Penyimpan/Gedong Penyimpan.png` },
  { id: "gedong-taksu", name: "Gedong Taksu", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.4 }, P: 0.9, L: 0.9, source: `${S}/Gedong Taksu/Gedong Taksu.png` },
  { id: "gedong-sari-v1", name: "Gedong Tumpang 2 (Gedong Sari) V1", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 4.2, tumpang: 2 }, P: 1.2, L: 1.2, source: `${S}/Gedong Tumpang 2 (Gedong Sari) V1/Gedong Tumpang 2 (Gedong Sari) V1.png` },
  { id: "gedong-sari-v2", name: "Gedong Tumpang 2 (Gedong Sari) V2", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 4.4, tumpang: 2, badan: "diamond" }, P: 1.1, L: 1.1, source: `${S}/Gedong Tumpang 2 (Gedong Sari) V2/Gedong Tumpang 2 (Gedong Sari) V2.png` },
  { id: "gedong-betara-desa-1", name: "Gedong Betara Desa", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 5.6, rong: 2 }, P: 3.58, L: 3.58, source: `${S}/Gedong Betara Desa 2/Gedong Betara Desa 2.png`, note: "Denah: 357,5 cm" },
  { id: "gedong-arca", name: "Gedong Arca", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 4.6, rong: 3 }, P: 2.6, L: 2.6, source: `${S}/Gedong Arca/Tampak Depan.jpg` },
  { id: "arip-arip", name: "Arip-Arip", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.8 }, P: 1.3, L: 1.3, source: `${S}/Arip-Arip/Arip-Arip.png` },
  { id: "pesimpangan-batukaru", name: "Pesimpangan Batu Karu", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.3, badan: "diamond" }, P: 0.75, L: 0.75, source: `${S}/Pesimpangan Batu karu/Pesimpangan Batu Karu.png` },
  { id: "pesimpangan-uluwatu", name: "Pesimpangan Uluwatu", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.2, badan: "diamond" }, P: 0.77, L: 0.77, source: `${S}/Pesimpangan Uluwatu/Pesimpangan Uluwatu.png` },
  { id: "pesimpangan-puncak-tedung", name: "Pesimpangan Puncak Tedung", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.6, tumpang: 2 }, P: 0.9, L: 0.9, source: `${S}/Persimpangan Puncak Tedung/Pesimpangan Puncak Tedung.png` },
  { id: "taksu", name: "Taksu", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.26 }, P: 1.3, L: 1.3, source: `${S}/Taksu/Taksu.png` },
  { id: "taksu-agung", name: "Taksu Agung", group: "Suci", kind: "shrine", shrine: { family: "gedong", H: 3.6 }, P: 1.32, L: 1.32, source: `${S}/Taksu Agung/Taksu Agung.png` },
  { id: "kemulan-v1", name: "Kemulan (rong tiga) V1", group: "Suci", kind: "shrine", shrine: { family: "kemulan", H: 3.3 }, P: 1.49, L: 1.3, source: `${S}/Kemulan/Kemulan V1/Tampak Depan.jpg` },
  { id: "kemulan-v2", name: "Kemulan V2", group: "Suci", kind: "shrine", shrine: { family: "kemulan", H: 3.4 }, P: 1.7, L: 1.4, source: `${S}/Kemulan/Kemulan V2/Kemulan V2.png` },
  { id: "kemulan-v3", name: "Kemulan V3", group: "Suci", kind: "shrine", shrine: { family: "kemulan", H: 3.6 }, P: 1.6, L: 1.4, source: `${S}/Kemulan/Kemulan V3/Kemulan V3.png` },
  { id: "padmasana", name: "Padmasana", group: "Suci", kind: "shrine", shrine: { family: "padmasana", H: 3.34 }, P: 1.35, L: 1.35, source: `${S}/Padmasana/Padmasana.png`, note: "Ukuran gambar: 0,20 + 0,84 + 0,98 + 1,32 m; lebar 1,35 m" },
  { id: "tugu-ratu-nglurah", name: "Tugu (Ratu Nglurah)", group: "Suci", kind: "shrine", shrine: { family: "tugu", H: 2.9 }, P: 1.12, L: 1.12, source: `${S}/Tugu (Ratu Nglurah)/Tugu (Ratu Nglurah).png`, note: "Lebar 112 cm, tinggi 290 cm" },
  { id: "tugu-ratu-nglurah-agung", name: "Tugu (Ratu Nglurah Agung)", group: "Suci", kind: "shrine", shrine: { family: "tugu", H: 3.3 }, P: 0.9, L: 0.9, source: `${S}/Tugu (Ratu Nglurah Agung)/Tugu (Ratu Nglurah Agung).png` },
  { id: "meru-tumpang-tiga", name: "Meru Tumpang Tiga", group: "Suci", kind: "shrine", shrine: { family: "meru", H: 6.5, tumpang: 3 }, P: 2.4, L: 2.4, source: `${S}/Meru Tumpang Tiga/Tampak Depan-1.jpg`, note: "Denah 240 cm" },
  { id: "meru-tumpang-sebelas", name: "Meru Tumpang Sebelas", group: "Suci", kind: "shrine", shrine: { family: "meru", H: 13, tumpang: 11 }, P: 3.4, L: 3.4, source: `${S}/Meru Tumpang Sebelas/Tampak Depan.jpg` },
  // bale suci terbuka (pakai generator bale + atap ijuk + murdha)
  { id: "piasan-v1", name: "Piasan V1", group: "Suci", kind: "bale", base: "bale_dangin", spec: { sakaCount: 4, sakaGrid: [2, 2], walls: { back: false, left: false, right: false, front: false }, plinthHeight: 0.75, sakaHeight: 1.6, roofMaterial: "ijuk", sacred: true }, P: 2.9, L: 2.2, source: `${S}/Piasan/Piasan V1/Tampak Depan.jpg`, note: "Alas 274 cm" },
  { id: "piasan-v2", name: "Piasan V2", group: "Suci", kind: "bale", base: "bale_dangin", spec: { sakaCount: 4, sakaGrid: [2, 2], walls: { back: true, left: false, right: false, front: false }, plinthHeight: 0.8, sakaHeight: 1.7, roofMaterial: "alang-alang", sacred: true }, P: 3.0, L: 2.4, source: `${S}/Piasan/Piasan V2/Piasan V2.png`, note: "Alas 295 cm" },
  { id: "piasan-agung", name: "Piasan Agung", group: "Suci", kind: "bale", base: "bale_dangin", spec: { sakaCount: 8, sakaGrid: [4, 2], walls: { back: false, left: false, right: false, front: false }, plinthHeight: 0.9, roofMaterial: "alang-alang", sacred: true }, P: 6.4, L: 3.8, source: `${S}/Piasan Agung/Tampak Selatan.jpg` },
  { id: "bale-agung", name: "Bale Agung", group: "Suci", kind: "bale", base: "bale_dangin", spec: { sakaCount: 12, sakaGrid: [6, 2], walls: { back: false, left: false, right: false, front: false }, plinthHeight: 1.0, roofMaterial: "alang-alang", sacred: true }, P: 11.5, L: 4.0, source: `${S}/Bale Agung/Bale Agung v2/Tampak Depan.jpg` },
  { id: "pepelik", name: "Pepelik V2", group: "Suci", kind: "bale", base: "bale_dangin", spec: { sakaCount: 4, sakaGrid: [2, 2], walls: { back: false, left: false, right: false, front: false }, plinthHeight: 1.2, sakaHeight: 1.4, roofMaterial: "ijuk", sacred: true }, P: 2.2, L: 2.0, source: `${S}/Pepelik/Pepelik V2/Pepelik V2.png`, note: "Lebar 210 cm" },
  { id: "pelinggih-ratu-sasih", name: "Pelinggih Ratu Sasih", group: "Suci", kind: "bale", base: "bale_dangin", spec: { sakaCount: 4, sakaGrid: [2, 2], walls: { back: true, left: false, right: false, front: false }, plinthHeight: 1.2, sakaHeight: 1.5, roofMaterial: "ijuk", sacred: true }, P: 3.4, L: 2.6, source: `${S}/Pelinggih Ratu Sasih/Tampak Depan.png` },
  { id: "tanpa-nama", name: "Bale suci (Tanpa Nama)", group: "Suci", kind: "bale", base: "bale_dangin", spec: { sakaCount: 4, sakaGrid: [2, 2], walls: { back: false, left: false, right: false, front: false }, plinthHeight: 0.9, sakaHeight: 1.6, roofMaterial: "alang-alang", sacred: true }, P: 3.2, L: 2.6, source: `${S}/Tanpa Nama/Tampak Depan.jpg` },
];

export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((e) => [e.id, e])) as Record<string, CatalogEntry>;

/** entri bawaan untuk tiap tipe di kompleks (saat pindah ke mode tunggal) */
export const DEFAULT_ENTRY: Record<BuildingType, string> = {
  bale_daja: "meten-sakutus",
  bale_dangin: "sakaroras",
  bale_dauh: "sakenem",
  bale_delod: "sakepat",
  paon: "paon",
  jineng: "jineng",
  merajan: "kemulan-v1",
  penunggun_karang: "tugu-ratu-nglurah",
  angkul_angkul: "kori",
};
