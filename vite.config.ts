import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  const effectiveApiUrl = loadedEnv.VITE_API_URL;
  const assuranceApiTarget = effectiveApiUrl || "https://api.d3vonn.io";
  const assuranceRumProxy = {
    target: assuranceApiTarget,
    changeOrigin: true,
    secure: true,
  };

  return {
    // Direct import.meta.env.VITE_API_URL references are replaced at build time.
    // The matching guard in src/lib/env.ts covers its dynamic-key lookup.
    define: effectiveApiUrl
      ? {
          "import.meta.env.VITE_API_URL": JSON.stringify(effectiveApiUrl),
        }
      : {},
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api/assurance/public/rum": assuranceRumProxy,
      },
    },
    preview: {
      host: "::",
      port: 4173,
      proxy: {
        // Keep local production-interaction audits same-origin. Only the public
        // RUM endpoint is proxied; the rest of the API remains unchanged.
        "/api/assurance/public/rum": assuranceRumProxy,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      viteStaticCopy({
        targets: [
          { src: "MASTER_CONTEXT.md", dest: "." },
          { src: "manifest.json", dest: "." },
          { src: "background.js", dest: "." },
          { src: "popup.html", dest: "." },
          { src: "popup.js", dest: "." },
          { src: "popup.css", dest: "." },
          { src: "settings.html", dest: "." },
          { src: "settings.js", dest: "." },
          { src: "settings.css", dest: "." },
          { src: "icons/**/*", dest: "icons" },
        ],
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Add support for importing .tf files as raw text
    assetsInclude: ["**/*.tf"],
    build: {
      // Several legacy manifest source files use ESM syntax with a .cjs suffix.
      // Let Rollup transform those mixed modules instead of parsing them as pure CJS.
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      // Target modern browsers for smaller output
      target: "es2020",
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Split vendor chunks to reduce the main bundle size
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Core React runtime — always needed on first paint
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("react-router-dom")
            ) {
              return "vendor-react";
            }
            // Framer Motion — heavy animation library, loaded async
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            // Radix UI components
            if (id.includes("@radix-ui")) {
              return "vendor-ui";
            }
            // Supabase — only needed for auth/data operations
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            // Sentry — monitoring, not critical path
            if (id.includes("@sentry")) {
              return "vendor-sentry";
            }
            // Tanstack Query
            if (id.includes("@tanstack")) {
              return "vendor-query";
            }
            // Recharts + D3 — only used in dashboard pages
            if (id.includes("recharts") || id.includes("d3-")) {
              return "vendor-charts";
            }
            // Lucide icons — tree-shakeable but still significant
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            // Utility libraries
            if (
              id.includes("date-fns") ||
              id.includes("clsx") ||
              id.includes("class-variance-authority") ||
              id.includes("tailwind-merge")
            ) {
              return "vendor-utils";
            }
          },
        },
      },
      // Raise the chunk size warning limit to match the current vendor split strategy
      chunkSizeWarningLimit: 1000,
    },
  };
});
