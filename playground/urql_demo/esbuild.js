const { build } = require('esbuild');

build({
  entryPoints: ['./index.ts'], 
  outbase: './',
  outdir: './dist',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  external: [], 
  watch: false,
});