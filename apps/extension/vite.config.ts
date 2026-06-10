import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { resolve } from "path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pkgs = resolve(__dirname, "../../packages");

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: "./", // ← required for Chrome extensions (relative asset paths)
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: false,
    target: "chrome120",
    sourcemap: false,
    minify: false, // keep readable for dev
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: (info) =>
          info.name?.endsWith(".css") ? "popup.css" : "assets/[name][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "@binge-room/shared-types": resolve(pkgs, "shared-types/src/index.ts"),
      "@binge-room/shared-utils": resolve(pkgs, "shared-utils/src/index.ts"),
      "@binge-room/event-schema": resolve(pkgs, "event-schema/src/index.ts"),
      "@binge-room/platform-sdk": resolve(pkgs, "platform-sdk/src/index.ts"),
    },
  },
});
