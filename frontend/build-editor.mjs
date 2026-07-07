// 将 Tiptap 打包为单文件，供前端直接使用
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['tiptap-entry.js'],
  bundle: true,
  outfile: 'src/tiptap-bundle.js',
  format: 'iife',
  globalName: 'TiptapBundle',
  platform: 'browser',
  minify: false,
  target: ['chrome100'],
  banner: {
    js: '// Tiptap Editor Bundle - Auto-generated, do not edit\n'
  }
});

console.log('Build complete: src/tiptap-bundle.js');
