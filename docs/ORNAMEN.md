# Ornamen Bali & Mode Bangunan Tunggal

## Yang sudah ada (versi parametrik)

Semua ornamen dibuat dari bentuk dasar di `src/components/bali3d/ornaments.tsx`, ukurannya **mengikuti ukuran bangunan**, jadi panjang × lebar × tinggi (dan tabel kesesuaian jarak) tidak berubah.

| Ornamen | Letak |
| --- | --- |
| Pepalihan | profil bertingkat bebaturan |
| Patra | pita ukiran di badan bebaturan, atas dinding, atas pintu, ambang angkul-angkul |
| Canggahwang | kepala saka |
| Murdha | puncak atap bale & pelinggih |
| Ikut celedu | dua ujung bubungan |
| Kori | bingkai prada + daun pintu berukir |

Tombol **Ornamen** (mode Kompleks) untuk menyalakan/mematikan — matikan kalau perangkat terasa berat.

## Mode Bangunan Tunggal

Untuk melihat/menyajikan bangunan satu per satu:
1. Pilih **Bangunan tunggal** di toolbar (atau klik bangunan di mode Kompleks dulu supaya ukurannya ikut).
2. Pilih tipe & isi panjang/lebar (garis atap, sama dengan denah 2D).
3. Tampak **Depan / Samping / Atas / Perspektif** dengan garis ukur P, L, T.
4. Ubah parameter tampak depan (bebaturan, saka, kemiringan atap, bahan) di panel kanan.
5. **Unduh 3D** → file `.glb` (bisa dibuka di Blender, Windows 3D Viewer, atau dimasukkan ke laporan).

## Cara menyempurnakan ornamen (data yang perlu dikumpulkan)

Isi `data/katalog-ornamen.csv` — satu baris per ornamen: bangunan, titik tempel, ukuran relatif, material, sumber.

Sumber yang disarankan:
- **Gambar tampak depan/samping** dari *Traditional Balinese Building Architecture Dataset* (Mendeley, DOI 10.17632/h7hxgwydzj, CC BY 4.0) → proporsi pepalihan, posisi murdha, tinggi pita patra.
- **Gelebet dkk. (1986), *Arsitektur Tradisional Daerah Bali*** → nama, jenis, dan aturan letak ornamen.
- **Foto sendiri** (lurus dari depan, cahaya rata) → dijadikan tekstur patra/ukiran. Kalau pakai foto orang lain, pastikan lisensinya mengizinkan.
- Untuk ornamen yang rumit (karang boma, padmasana): modelkan di **Blender** dari gambar tampak, ekspor `.glb`, lalu ditempel di titik tempelnya.

Langkah teknis mengganti pola patra dengan tekstur asli: taruh gambar di `public/textures/patra.jpg`, lalu ganti fungsi `getPatraCanvas()` di `ornaments.tsx` agar memuat gambar tersebut.
