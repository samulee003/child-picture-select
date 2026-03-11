import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0' // 監聽所有介面，支援 IPv4 和 IPv6
  }
});


