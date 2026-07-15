import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:8000",
      "/models": "http://localhost:8000",
      "/presets": "http://localhost:8000",
      "/simulations": "http://localhost:8000",
      "/validate": "http://localhost:8000"
    }
  },
  optimizeDeps: {
    include: [
      "@react-three/fiber",
      "@react-three/drei/core/Line",
      "@react-three/drei/core/OrbitControls",
      "@react-three/drei/core/Text",
      "three"
    ]
  },
  test: {
    environment: "jsdom"
  }
});

