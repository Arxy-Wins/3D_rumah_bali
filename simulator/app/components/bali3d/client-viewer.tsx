import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";

// three.js hanya bisa jalan di browser, jadi viewer dimuat setelah komponen ter-mount (tanpa SSR)
const Viewer3D = lazy(() => import("./viewer-3d"));

export default function ClientViewer3D(props: ComponentProps<typeof Viewer3D>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Memuat model 3D…</div>}>
      <Viewer3D {...props} />
    </Suspense>
  );
}
