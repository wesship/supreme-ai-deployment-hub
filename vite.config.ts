import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { publicRoutePreloads } from "./scripts/public-route-preloads.mjs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  const effectiveApiUrl = loadedEnv.VITE_API_URL;

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
    },
    plugins: [
      react(),
      publicRoutePreloads(),
      mcpPlugin({ mcpEntry: "src/lib/mcp-server/index.ts" }),
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
      // Keep application CSS in a single build asset. The root application is loaded\n      // through a guarded dynamic import; async CSS chunks can otherwise reject that\n      // import during stylesheet preload even when the asset itself is healthy.\n      cssCodeSplit: false,
      // Split vendor chunks to reduce the main bundle size
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Shared homepage presentation must never be placed in App's chunk
            // when telemetry is tree-shaken. Both entries import these modules.
            const modulePath = id.replaceAll('\\', '/');
            if (['/src/pages/AIFilms.tsx', '/src/components/shell/SignalAtmosphere.tsx',
              '/src/lib/mountPageVoiceReader.tsx'].some((path) => modulePath.endsWith(path))) {
              return 'film-presentation';
            }
            if (modulePath.endsWith('/src/pages/Index.tsx')) {
              return 'homepage-presentation';
            }
            if (
              ['/src/components/ScrollToTop.tsx',
                '/src/components/SkipToContent.tsx', '/src/lib/isLocalPreview.ts',
                '/src/lib/assurance/rum.ts',
                '/src/components/sovereign/approved/ReduceMotionToggle.tsx'].some((path) => modulePath.endsWith(path))
              || modulePath.includes('/node_modules/next-themes/')
              || modulePath.includes('/node_modules/react-helmet-async/')
              || modulePath === '\0vite/preload-helper.js'
            ) {
              return 'public-shell';
            }
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
            // Let Rollup split Radix by actual route usage. A single vendor-ui
            // chunk makes a public button download every private UI primitive.
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
            if (id.includes("node_modules/") && (id.includes("/recharts") || id.includes("/d3-"))) {
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
