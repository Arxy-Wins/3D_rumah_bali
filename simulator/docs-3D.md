# Model 3D Tata Letak

Setelah form **Building Layout** diproses, muncul model 3D di bawah gambar tata letak.
Modul 3D sama dengan yang ada di repo `bali-building-plan-design` (`app/lib/bali3d`, `app/components/bali3d`).

- Posisi bangunan dihitung dari rumus jarak Asta Kosala Kosali (pengali × footLength + sideFootLength, tier S1–S3), diukur tepi ke tepi.
- Bali Utara/Selatan menentukan arah kaja; *Land Direction* menentukan sisi angkul-angkul, dengan segmen 1/9 sisi dari filosofi `BaliLocationOfDoor`.
- Tabel kesesuaian membandingkan jarak di 3D dengan rumus; jarak yang tidak muat di ukuran lahan ditandai ✗.
- Viewer dimuat tanpa SSR (`client-viewer.tsx`), jadi aman untuk React Router SSR.
- Model 3D tidak bergantung pada API gambar; kalau API gagal, 3D tetap tampil.
