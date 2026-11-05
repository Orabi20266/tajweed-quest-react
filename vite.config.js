import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  /* مسارات نسبية لتعمل النسخة على Cloudflare وعلى GitHub Pages (مجلد فرعي) */
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
