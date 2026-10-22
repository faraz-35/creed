import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built site works at any path (domain root,
// GitHub Pages subpath, a subdirectory — anywhere).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
