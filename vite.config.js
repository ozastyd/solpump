import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single self-contained dist/index.html (inline JS/CSS + base64 assets),
// matching the artifact shape build.sh has always produced.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});
