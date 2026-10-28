// Isolated frontend only: no proxy, backend, credentials or database.
// Build rather than use the dev server: shared/scryfallQuery.js is CommonJS
// imported by the frontend; Vite's production bundler provides the interop.
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const outDir = mkdtempSync(join(tmpdir(), 'scrybox-pwa-build-'));
const config = {
  configFile: false,
  plugins: [react()],
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify('browser-test') },
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm', 'module', 'browser', 'development|production'] },
  build: { outDir, emptyOutDir: true, rollupOptions: { input: { app: resolve('index.html'), inspector: resolve('tests/browser/inspector.html') } } },
  preview: { host: '127.0.0.1', port: Number(process.env.PWA_TEST_PORT || 4178), strictPort: true },
};
await build(config);
const server = await preview(config);
process.on('SIGTERM', () => { server.httpServer.close(); rmSync(outDir, { recursive: true, force: true }); process.exit(0); });
