import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create dist directory
mkdirSync(join(__dirname, 'dist'), { recursive: true });
mkdirSync(join(__dirname, 'dist', 'assets'), { recursive: true });

// Build the app with CSS
await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outdir: 'dist/assets',
  format: 'esm',
  jsx: 'automatic',
  loader: { 
    '.jsx': 'jsx', 
    '.js': 'jsx'
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.VITE_API_URL': '""',
    'import.meta.env.VITE_OPENAI_API_KEY': '""',
    'import.meta.env.MODE': '"production"',
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true'
  },
  minify: true,
});

// Copy index.html to dist and update script path
const html = readFileSync('index.html', 'utf-8')
  .replace('type="module" src="/src/main.jsx"', 'type="module" src="/assets/main.js"')
  .replace('</head>', '<link rel="stylesheet" href="/assets/main.css"></head>');

writeFileSync(join(__dirname, 'dist', 'index.html'), html);

// Copy public folder to dist if present
try {
  cpSync('public', 'dist', { recursive: true });
  console.log('✅ Build complete! Assets bundled! Run: node server.js');
} catch (err) {
  console.log('✅ Build complete! Assets bundled! (No public assets)');
}

