import dynamic from "next/dynamic";

// Halaman lama (gambar lahan + GAN + ToolBox) masih ada di src/components/main.tsx bila dibutuhkan lagi.
const Home3D = dynamic(() => import("@/components/home-3d"), { ssr: false });

export default function Page() {
  return <Home3D />;
}
