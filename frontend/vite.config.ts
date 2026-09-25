import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Dev server proxy: the app always calls `/api/...` on its own origin and Vite
 * forwards that to the Express API, so no CORS handling is needed in dev and
 * the production build can sit behind the same origin.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
