# 3D Rumah Bali

Rumah tradisional Bali 3D dari denah tampak atas, dengan tata letak Asta Kosala Kosali dan simulasi mitigasi gempa.

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

- **Tanpa GAN (seperti simulator):** isi *Parameter lahan* di bagian "Model 3D" → **Buat 3D**. Kalau lahan sudah digambar dengan tool Area, bentuknya ikut dipakai (diskalakan ke panjang × lebar).
- **Dengan GAN:** gambar lahan + jalan → Generate → pilih **Denah GAN** atau **Aturan Asta Kosala Kosali**, lalu cek tabel kesesuaian jarak.

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
