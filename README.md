# 3D Rumah Bali

Rumah tradisional Bali 3D dari denah tampak atas, dengan tata letak Asta Kosala Kosali.

> Fitur mitigasi gempa sedang dinonaktifkan dari tampilan (`ENABLE_GEMPA = false` di `src/components/bali3d/viewer-3d.tsx`); kodenya tetap ada di `src/lib/bali3d/seismic.ts`.

Turunan dari:
- [rikautamii/bali-building-plan-design](https://github.com/rikautamii/bali-building-plan-design) — generator denah (GAN pix2pix, TensorFlow.js)
- [rikautamii/bali-building-simulator-main](https://github.com/rikautamii/bali-building-simulator-main) — simulator Asta Kosala Kosali (folder `simulator/`)
- [rikautamii/bali-building-simulator-api](https://github.com/rikautamii/bali-building-simulator-api) — aturan jarak & filosofi pintu pekarangan (diport ke `src/lib/bali3d/asta-rules.ts`)

## Isi

| Folder | Isi |
| --- | --- |
| `/` (Next.js) | Gambar lahan → GAN menghasilkan denah → model 3D (mode **Denah GAN** atau **Aturan Asta Kosala Kosali**), tabel kesesuaian jarak, peta mitigasi & simulasi gempa |
| `simulator/` (React Router) | Form Building Layout → gambar tata letak dari API + model 3D dari aturan |
| `src/lib/bali3d`, `src/components/bali3d` | Modul 3D (segmentasi denah, parameter tampak depan, aturan Asta Kosala Kosali, analisis gempa, viewer three.js) |

Detail: [`docs/3D-MITIGASI-GEMPA.md`](docs/3D-MITIGASI-GEMPA.md).

## Alur pakai

Buka halaman → isi **Parameter lahan** (panjang & lebar telapak kaki, panjang & lebar lahan, arah gerbang, Bali Utara/Selatan) → **Buat 3D**. Tabel kesesuaian menunjukkan jarak aturan vs jarak di 3D.

Halaman lama (gambar lahan + GAN + ToolBox) masih ada di `src/components/main.tsx` tapi tidak dipakai di halaman utama. Model GAN di `public/model` tidak diunduh lagi oleh halaman ini.

## Jalankan lokal

```bash
npm install
npm run dev          # http://localhost:3000

cd simulator
npm install
npm run dev          # http://localhost:5173/simulator
```

## Deploy ke Vercel

**Aplikasi utama (Next.js)**
1. Buka https://vercel.com/new → *Import* repo `3D_rumah_bali`.
2. Framework terdeteksi otomatis sebagai **Next.js**, Root Directory `./`. Klik **Deploy**.

**Simulator (opsional, project Vercel kedua)**
1. *Import* repo yang sama lagi.
2. Root Directory: `simulator` (pengaturan build sudah ada di `simulator/vercel.json`). Klik **Deploy**.

Catatan: model GAN di `public/model` sudah dikuantisasi ke uint8 (±54 MB, 13 shard; aslinya float32 ±208 MB) dengan `scripts/quantize_tfjs.py`. Hasil denah praktis identik (selisih rata-rata piksel 0,13 dari 255; bangunan terdeteksi sama). Model diunduh sekali per kunjungan saat Generate pertama, dengan indikator persentase.

## Atribusi

Gambar pembanding di `public/elevations/` dan acuan bentuk/ukuran ornamen berasal dari *Traditional Balinese Building Architecture Dataset* — I Gusti Agung Gede Arya Kadyanan dkk., Mendeley Data, DOI [10.17632/h7hxgwydzj](https://doi.org/10.17632/h7hxgwydzj), lisensi CC BY 4.0. Gambar dipotong margin dan diperkecil.

## Lahan tidak persegi

Form "Parameter lahan" punya pilihan **Bentuk lahan**:

| Pilihan | Yang diisi | Cocok untuk |
|---|---|---|
| Persegi panjang | lebar depan, panjang ke dalam | lahan kotak (sama dengan GitHub asal) |
| Trapesium | sisi depan, belakang, kedalaman, geser | lahan melebar/menyempit ke belakang |
| Ukur 4 sisi + 1 diagonal | depan, kanan, belakang, kiri, diagonal depan-kiri → belakang-kanan | ukuran sertifikat / meteran di lapangan |
| Bentuk L | ukuran lahan + potongan di pojok belakang | lahan berpotongan |
| Titik sudut bebas | koordinat tiap pojok (kanan, dalam) | bentuk apa pun |

Kanan/kiri dilihat dari jalan menghadap lahan; sisi depan = sisi gerbang. Rumus, pengali, tier, syarat lahan (minimal 6×7, panjang ≠ lebar) tetap aturan asli GitHub; tier dari kotak luar (panjang × lebar), posisi gerbang = sisi depan ÷ 9 (seperti API), tetapi batas lahan, jarak ke tembok, dan penyengker mengikuti bentuk aslinya.
