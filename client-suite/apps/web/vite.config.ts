import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: {
    port: 5176,
    host: '127.0.0.1',
    proxy: {
      // Proxy API calls to HMR backend during dev
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      // Proxy Matrix Client API to local Conduit
      '/_matrix': {
        target: 'http://127.0.0.1:6167',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      // E2EE is disabled — replace crypto-wasm with a no-op stub to avoid
      // loading the 5.3MB .wasm binary that Vite cannot bundle correctly.
      '@matrix-org/matrix-sdk-crypto-wasm': new URL(
        './src/infrastructure/matrix/crypto-wasm-stub.ts',
        import.meta.url
      ).pathname,
    },
  },
  optimizeDeps: {
    // matrix-js-sdk uses dynamic imports that confuse esbuild pre-bundling
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        ops: resolve(__dirname, 'ops.html'),
      },
      external: [],
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-matrix': ['matrix-js-sdk'],
          'vendor-zustand': ['zustand'],
        },
      },
    },
  },
});
