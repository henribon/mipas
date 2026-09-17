import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const BASE = '/mipas/';

// Libraries in files of their own stay cached across deploys, which mostly change the app.
// The CommonJS helpers are pinned to one chunk so their place can't shuffle the hashes.
const VENDOR_CHUNKS = {
  react: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]|commonjsHelpers/,
  leaflet: /[\\/]node_modules[\\/]leaflet[\\/]/,
  supabase: /[\\/]node_modules[\\/](@supabase[\\/]|iceberg-js[\\/])/,
};

// A font referenced from CSS is only requested once the CSS is parsed and text is laid out.
function preloadFonts(): Plugin {
  return {
    name: 'mipas-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (_html, ctx) => Object.keys(ctx.bundle || {})
        .filter(file => /\.(otf|ttf|woff2?)$/.test(file))
        .map(file => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', href: BASE + file, crossorigin: true },
          injectTo: 'head',
        })),
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss(), preloadFonts()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'framer-motion'],
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    // Leaflet's CSS points at icons the app never shows; as files, they are never downloaded.
    assetsInlineLimit: (file) => (VENDOR_CHUNKS.leaflet.test(file) ? false : undefined),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.endsWith('.css')) return undefined;
          return Object.keys(VENDOR_CHUNKS).find(name => VENDOR_CHUNKS[name].test(id));
        },
      },
    },
  },
});
