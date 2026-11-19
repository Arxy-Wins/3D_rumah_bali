# Ornamen Bali & Mode Bangunan Tunggal

## Hasil kalibrasi dari dataset

Dicek terhadap gambar tampak & potongan *Traditional Balinese Building Architecture Dataset* (Mendeley Data, DOI 10.17632/h7hxgwydzj, CC BY 4.0):

- Bale hunian (Meten Sakutus, Sakenem, Sakepat, Sakaroras) **tidak memakai murdha/ikut celedu** — bubungan lurus. Tiang Sanga (atap limas) bermahkota kotak kecil. Murdha hanya untuk bangunan suci (Gedong).
- Atap alang-alang tebal dengan kaki atap melebar/melengkung; atap jineng lengkung runcing; atap gedong berbentuk kubah ijuk.
- Bebaturan Meten: pilaster segaris saka + panel persegi; tinggi 1,0 m (Potongan A-A: tanah −100, lantai ±00, bubungan +350). Sakaroras: tanah −60, bubungan +400.
- Meten: emper kecil di atas pintu + jendela persegi di dinding depan. Sakenem: sendi bulat + bale-bale di antara tiang.
- Kori: badan seperti candi (pilaster sayap bertingkat, motif kotak, kepala bertingkat, atap limas berpuncak datar); tembok penyengker berpilaster dengan mahkota.

Gambar tampak depan dataset ada di `public/elevations/` dan tampil sebagai pembanding saat bangunan diklik.

## Ornamen yang sudah ada (versi parametrik)

Semua ornamen dibuat dari bentuk dasar di `src/components/bali3d/ornaments.tsx`, ukurannya **mengikuti ukuran bangunan**, jadi panjang × lebar × tinggi (dan tabel kesesuaian jarak) tidak berubah.

| Ornamen | Letak |
| --- | --- |
| Bebaturan pilaster + panel | bale hunian |
| Atap melengkung (flare / kubah / lengkung runcing) | bale / pelinggih / jineng |
| Bubungan lurus, mahkota kotak (limas) | bale hunian |
| Murdha | bangunan suci (merajan, penunggun karang) |
| Sendi bulat, kepala saka, canggahwang | saka |
| Bale-bale | bale terbuka |
| Emper + jendela persegi + kori berprada | Bale Daja (Meten) |
| Kori bergaya candi + penyengker berpilaster | angkul-angkul & tembok |

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

## Katalog lengkap (mode Bangunan tunggal)

Semua bangunan di dataset kini bisa dipilih satu per satu di mode **Bangunan tunggal** (`src/lib/bali3d/catalog.ts`, 48 entri):

- **Tempat tinggal (14):** Meten Sakutus, Meten Sakutus Mamben, Meten Gunungrata (2 varian), Bale Paduman, Sakepat, Sakenem, Sakaroras, Sangasari, Tiang Sanga, Jineng, Gelebeg, Kelumpu, Kori. Paon tidak ada di dataset (perkiraan).
- **Tempat suci (34):** Gedong V1–V5, Gedong Kembar V1–V2, Penyimpan, Gedong Taksu, Gedong Sari (tumpang 2) V1–V2, Betara Desa, Arca, Arip-Arip, Pesimpangan (Batu Karu, Uluwatu, Puncak Tedung), Taksu, Taksu Agung, Kemulan V1–V3, Padmasana, Tugu (Ratu Nglurah, Ratu Nglurah Agung), Meru Tumpang Tiga & Sebelas, Piasan V1–V2, Piasan Agung, Bale Agung, Pepelik, Pelinggih Ratu Sasih, bale suci tanpa nama.

Generator pelinggih (`src/components/bali3d/shrines.tsx`) punya lima keluarga: gedong, kemulan, padmasana, tugu, meru. Susunannya tepas → kaki (pepalihan + karang sudut) → badan → rong berpintu prada → atap kubah ijuk (1–2 tumpang, meru 3–11) → murdha. Lebar dan tinggi diambil dari angka di gambar bila tertulis (misalnya Padmasana 1,35 × 3,34 m, Tugu 1,12 × 2,90 m, Meru Tumpang Tiga denah 2,40 m). Selebihnya diperkirakan dari proporsi gambar.

Di mode Kompleks (ornamen aktif), **merajan** disusun dari Taksu (kaja-kauh), Kemulan rong tiga (tengah), Padmasana (kaja-kangin), dan Piasan kecil bila muat. **Penunggun karang** memakai model Tugu.

Gambar pembanding tiap entri ada di `public/elevations/catalog/<id>.jpg` (dipangkas dari dataset, CC BY 4.0).
