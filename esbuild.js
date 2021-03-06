const { build } = require('esbuild');

build({
  entryPoints: ['./src/index.ts'], 
  outbase: './src',
  outdir: './dist',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: [], 
  watch: false,
});