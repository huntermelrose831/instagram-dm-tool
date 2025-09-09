import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./", // Use relative paths for Electron
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5001", // Match backend port
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: "terser",
    rollupOptions: {
      external: mode === "production" ? ["electron"] : ["electron"], // Don't bundle electron
      output: {
        manualChunks: undefined, // Ensure single bundle for Electron
      },
    },
  },
  define: {
    // Define environment variables for Electron
    "process.env.ELECTRON": JSON.stringify(true),
    "process.env.NODE_ENV": JSON.stringify(mode),
    // Ensure global is available
    global: "globalThis",
  },
  optimizeDeps: {
    exclude: ["electron"], // Don't optimize electron in dependencies
  },
}));
