"use client";

import dynamic from "next/dynamic";

// three.js hanya jalan di browser
const Viewer3D = dynamic(() => import("./bali3d/viewer-3d"), { ssr: false });

/** Halaman utama: input parameter lahan → model 3D rumah Bali (aturan Asta Kosala Kosali) */
export default function Home3D() {
  return (
    <div className="container flex min-h-screen flex-col gap-4 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">3D Rumah Bali</h1>
        <p className="text-sm text-gray-500">
          Isi parameter lahan di panel kanan (ukuran lahan, telapak kaki, arah gerbang, Bali Utara/Selatan). Posisi bangunan
          dihitung dari rumus jarak Asta Kosala Kosali; tinggi & bentuk bangunan dari parameter tampak depan.
        </p>
      </div>
      <Viewer3D footLength={26} allowGan={false} />
    </div>
  );
}
