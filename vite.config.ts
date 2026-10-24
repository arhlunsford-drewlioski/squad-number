import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 builds one self-contained index.html (for publishing as an artifact).
const single = process.env.SINGLE === '1';
const stamp = new Date().toISOString();

/** Writes the build stamp into the service worker, so a new release is a new worker. */
function stampWorker(): Plugin {
  let out = 'dist';
  return {
    name: 'stamp-service-worker',
    configResolved(c) { out = c.build.outDir; },
    closeBundle() {
      const f = resolve(out, 'sw.js');
      if (existsSync(f)) writeFileSync(f, readFileSync(f, 'utf8').replace('__BUILD__', stamp.replace(/[^0-9A-Za-z]/g, '')));
    },
  };
}

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(stamp) },
  plugins: [react(), stampWorker(), ...(single ? [viteSingleFile()] : [])],
  build: { target: 'es2020', outDir: single ? 'dist-single' : 'dist' },
});
