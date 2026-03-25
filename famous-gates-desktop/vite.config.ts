import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  root: path.resolve(__dirname, './apps/desktop'),

  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/desktop/src'),
      '@bridge': path.resolve(__dirname, './apps/desktop/src/bridge'),
      '@services': path.resolve(__dirname, './apps/desktop/src/services'),
      '@features': path.resolve(__dirname, './apps/desktop/src/features'),
      '@components': path.resolve(__dirname, './apps/desktop/src/components'),
      '@hooks': path.resolve(__dirname, './apps/desktop/src/hooks'),
      '@state': path.resolve(__dirname, './apps/desktop/src/state'),
      '@constants': path.resolve(__dirname, './apps/desktop/src/constants'),
      '@utils': path.resolve(__dirname, './apps/desktop/src/utils'),
      '@shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },

  // to make use of `VITE_` prefixed env variables
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri supports es2021
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {},
  },
}));
