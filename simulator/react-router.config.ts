import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  // SPA mode supaya bisa di-deploy statis ke Vercel (viewer 3D memang hanya jalan di browser)
  ssr: false,
} satisfies Config;
