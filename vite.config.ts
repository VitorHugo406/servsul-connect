import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    allowedHosts: true,
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react-dom/") || id.includes("/react/") || id.includes("/scheduler/")) return "react-vendor";
          if (id.includes("@supabase/")) return "supabase-vendor";
          if (id.includes("react-router")) return "router-vendor";
          if (id.includes("recharts") || id.includes("/d3-")) return "charts-vendor";
          if (id.includes("xlsx")) return "xlsx-vendor";
          if (id.includes("jspdf") || id.includes("jspdf-autotable")) return "pdf-vendor";
          if (id.includes("html2canvas")) return "html2canvas-vendor";
          if (id.includes("@radix-ui/")) return "radix-vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
