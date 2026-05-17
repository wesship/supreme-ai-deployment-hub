
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
     viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "background.js", dest: "." },
        { src: "popup.html", dest: "." },
        { src: "popup.js", dest: "." },
        { src: "popup.css", dest: "." },
        { src: "settings.html", dest: "." },
        { src: "settings.js", dest: "." },
        { src: "settings.css", dest: "." },
        { src: "icons/**/*", dest: "icons" },  // This will copy everything inside "icons/"
      ],
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Add support for importing .tf files as raw text
  assetsInclude: ['**/*.tf'],
  build: {
    // Split vendor chunks to reduce the main bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI component library
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
          ],
          // Data fetching and state
          'vendor-query': ['@tanstack/react-query'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Monitoring
          'vendor-sentry': ['@sentry/react'],
          // Utilities
          'vendor-utils': ['date-fns', 'clsx', 'class-variance-authority', 'tailwind-merge'],
        },
      },
    },
    // Raise the chunk size warning limit to 600KB
    chunkSizeWarningLimit: 600,
  },
}));
