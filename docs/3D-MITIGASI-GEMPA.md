# Model 3D & Mitigasi Gempa

Fitur ini mengubah **denah hasil GAN (tampak atas, 256×256 berkode warna)** menjadi model 3D rumah Bali dan menganalisis mitigasi gempanya.

## Alur

1. **Segmentasi** (`src/lib/bali3d/segmentation.ts`)
   Piksel diklasifikasi ke warna legend → filter modus 3×3 (bersihkan noise GAN) → komponen terhubung per jenis bangunan → orientasi (PCA, diluruskan ke sudut lahan) → ukuran dalam meter.
   Skala sama dengan `output.tsx`: `meter = piksel / 2.08 × footLength / 100`.
   Warna di denah = **garis atap** (termasuk teritisan), bukan badan bangunan.
2. **Parameter tampak depan** (`src/lib/bali3d/specs.ts`)
   Denah tidak punya informasi tinggi, jadi tiap tipe bangunan punya parameter elevasi: tinggi bebaturan, jumlah & susunan saka, tinggi saka, bentuk/kemiringan atap, teritisan, material atap & dinding.
   Nilai default dari literatur; **kalibrasi dengan dataset tampak depan** (lihat bawah). Parameter juga bisa diubah per bangunan dari panel inspeksi.
3. **Penempatan** (`src/lib/bali3d/layout.ts`)
   Bangunan dihadapkan ke natah; badan = garis atap dikurangi teritisan.
4. **Model 3D** (`src/components/bali3d/*`, three.js + React Three Fiber)
   Bebaturan + undakan, sendi/umpak, saka, lambang–sineb, dinding (pintu di sisi natah), atap limasan/pelana/jineng, merajan dengan beberapa pelinggih, penunggun karang, angkul-angkul, tembok penyengker.
   Mode atap: Utuh / Tembus / Angkat / Lepas — supaya struktur di bawah atap kelihatan.
5. **Mitigasi gempa** (`src/lib/bali3d/seismic.ts`)
   - Per bangunan: bentuk denah, bobot atap, dinding pasangan tanpa perkuatan, sambungan saka–sendi, pengaku lateral, kelangsingan, jarak antar atap (benturan), estimasi `V = SDS·Ie/R · W` dan periode `T ≈ 0,0488·h^0,75`.
   - Tapak: zona runtuh (faktor × tinggi), area aman titik kumpul di natah + kapasitas (1 m²/orang), jalur evakuasi A* dari pintu tiap bangunan ke titik kumpul lalu ke luar lewat angkul-angkul, catatan angkul-angkul & penyengker.
   - "Terapkan perkuatan": menampilkan kolom praktis, sloof, ring balok, angkur saka–sendi, skur diagonal, dan menghitung ulang risiko.
   - "Simulasi gempa": animasi guncangan; goyangan tiap bangunan diskalakan dengan amplifikasi dinamis (periode bangunan vs periode guncangan) dan skor risikonya.

## Mode tata letak: Denah GAN vs Aturan Asta Kosala Kosali

- **Denah GAN**: posisi & ukuran bangunan dari denah keluaran GAN. Kalau GAN tidak menggambar angkul-angkul, gerbang ditambahkan di sisi "Gate Direction".
- **Aturan Asta Kosala Kosali** (`src/lib/bali3d/asta-rules.ts`, `asta-layout.ts`): posisi dihitung dari rumus jarak yang sama dengan tabel Jarak Bangunan (`pengali × footLength + sideFootLength`, tier S1–S3), diukur tepi ke tepi seperti panah di gambar tata letak API.
  - Kaja = utara untuk **Bali Selatan**, selatan untuk **Bali Utara** (sama dengan tataUtara vs tataUtaraBU di API). Kangin selalu timur.
  - Merajan di sudut kaja-kangin, Bale Daja dari Uma & Guru, Penunggun Karang dari Kala (sudut kaja-kauh) — tiga ini dikunci.
  - Bangunan lain disusun dengan optimasi (simulated annealing, seed tetap) agar sedekat mungkin dengan aturan, tidak bertumpuk (jarak bersih ≥0,8 m), natah tetap kosong, dan depan gerbang bebas. Kalau tetap tidak muat, ukuran bangunan non-utama diperkecil bertahap dan dicatat.
  - Angkul-angkul di sisi "Gate Direction", lebar 1/9 sisi, segmen mengikuti filosofi `BaliLocationOfDoor` (default: segmen baik pertama, bisa dipilih).
- **Tabel kesesuaian**: untuk kedua mode, jarak di 3D dibandingkan dengan rumus (toleransi ±10% atau 0,25 m).

Catatan: di banyak ukuran lahan, jumlah jarak aturan + ukuran bangunan lebih panjang dari lahan (mis. tier S3 lahan 14×18: Uma 6,34 + Bale Daja + Brahma 9,98 + Paon > 18 m), jadi tidak semua jarak bisa terpenuhi bersamaan. Ini sifat rumusnya, bukan galat penyusunan.

## Kalibrasi dengan dataset tampak depan

Dataset: *Traditional Balinese Building Architecture Dataset* — Mendeley Data, DOI 10.17632/h7hxgwydzj (CC BY 4.0), berisi gambar tampak depan, samping, potongan dan denah (JPG).

1. Ukur dari gambar tampak depan/samping tiap tipe: tinggi bebaturan, tinggi saka, kemiringan atap, teritisan, jumlah saka.
2. Masukkan angkanya ke `BUILDING_SPECS` di `specs.ts`.
3. (Opsional) taruh JPG tampak depan di `public/elevations/<tipe>.jpg` agar tampil di panel inspeksi.

## Uji tanpa GAN

Di bagian "Model 3D & Mitigasi Gempa" ada input untuk memuat PNG denah 256×256 langsung. Contoh: `docs/contoh-denah-uji.png`.

## Batasan

- Analisis gempa adalah estimasi tingkat perencanaan untuk edukasi, **bukan** pengganti perhitungan struktur. Cek nilai SDS lokasi di aplikasi Spektra Indonesia (PUSKIM PUPR).
- Ambang (rasio denah, jarak 1 m antar atap, zona runtuh 0,6×H, 1 m²/orang) adalah asumsi yang bisa diubah di kode/panel.
- Kualitas model 3D bergantung pada kebersihan denah GAN; bangunan yang terpecah/tergabung akan ikut salah.
