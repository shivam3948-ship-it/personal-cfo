#!/usr/bin/env node
// Builds a single static HTML page of Munim (offline rules + browser voice) for sharing as a link.
// Usage: npm run build:web-demo  -> web-demo/dist/munim.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..');
const demoDir = path.join(app, 'data', 'demo');
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (!/^(README\.md|expected\.json)$/.test(e.name)) files.push({ name: path.relative(demoDir, p), text: fs.readFileSync(p, 'utf8') }); } };
walk(demoDir);
fs.mkdirSync(path.join(here, '.gen'), { recursive: true });
fs.writeFileSync(path.join(here, '.gen', 'demo-files.json'), JSON.stringify(files));

const shim = (f) => path.join(here, 'shims', f);
const out = await build({
  entryPoints: [path.join(here, 'main.tsx')], bundle: true, write: false, format: 'iife', minify: true, target: 'es2020', platform: 'browser',
  jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', inject: [shim('react-inject.ts')],
  alias: { 'node:fs': shim('node-fs.ts'), 'node:path': shim('node-path.ts'), 'node:crypto': shim('node-crypto.ts'), '@anthropic-ai/sdk': shim('anthropic.ts'), unpdf: shim('unpdf.ts'), react: shim('react.ts'), 'react-dom/client': shim('react-dom-client.ts') },
  define: { 'process.env.DEMO_AS_OF': '""', 'process.env.ANTHROPIC_API_KEY': '""', 'process.env.ANTHROPIC_MODEL': '""', 'process.env.ANTHROPIC_EXTRACT_MODEL': '""', 'process.env.SARVAM_API_KEY': '""', 'process.env.NODE_ENV': '"production"' },
  // process shim for lib code; randomUUID fallback for non-secure contexts (it exists on https).
  banner: { js: 'var process=globalThis.process||{env:{},cwd:function(){return "/"}};if(globalThis.crypto&&!crypto.randomUUID){crypto.randomUUID=function(){var b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=Array.from(b,function(x){return(x+256).toString(16).slice(1)}).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20)}}' },
  logLevel: 'warning',
});
let css = fs.readFileSync(path.join(app, 'app', 'globals.css'), 'utf8');
// Artifact theme contract: the explicit dark toggle must win too.
const darkBlock = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^}]*)\}\s*\}/);
if (darkBlock) css = css.replace(darkBlock[0], `${darkBlock[0]}\n:root[data-theme="dark"] {${darkBlock[1]} color-scheme: dark; }`);
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<title>Munim</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
fs.mkdirSync(path.join(here, 'dist'), { recursive: true });
fs.writeFileSync(path.join(here, 'dist', 'munim.html'), html);
console.log(`web-demo/dist/munim.html ${(html.length / 1024).toFixed(0)} KB, ${files.length} demo files embedded`);
