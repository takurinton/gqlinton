const { build } = require('esbuild');

build({
  entryPoints: ['./src/index.ts'], 
  outbase: './src',
  outdir: './dist',
  bundle: true,
  platform: 'node',
  external: [], 
  watch: false,
});