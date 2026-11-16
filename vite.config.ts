import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    allowedHosts: true,
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      // Todos os `toast` do sonner viram a bolinha de avisos (embaixo, no centro).
      { find: /^sonner$/, replacement: path.resolve(__dirname, "./src/lib/pillToast.tsx") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
}));
