import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The SPA talks to the Express API on relative /api/* URLs in production
// (same Vercel deployment) and through this dev proxy during `npm run client:dev`.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          firebase: ['firebase/app', 'firebase/auth'],
        },
      },
    },
  },
});
