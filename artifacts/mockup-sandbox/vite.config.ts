import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

// ✅ PORT: Vercel'de optional, fallback değer kullan
const port = Number(process.env.PORT) || (process.env.NODE_ENV === "production" ? 3000 : 5173);

// ✅ BASE_PATH: Vercel'de optional, default '/'
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    // 🛡️ Replit plugin'leri sadece REPL_ID varsa çalışır, Vercel'de atlanır
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          (async () => {
            const mod = await import("@replit/vite-plugin-cartographer");
            return mod.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            });
          })(),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});