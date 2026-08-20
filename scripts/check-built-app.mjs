import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const distRoot = path.join(projectRoot, 'dist');
const budgets = {
  entryJavaScriptGzip: 170 * 1024,
  entryCssGzip: 21 * 1024,
  anyJavaScriptGzip: 230 * 1024,
};

async function requireFile(relativePath) {
  const fullPath = path.resolve(distRoot, relativePath);
  if (!fullPath.startsWith(`${distRoot}${path.sep}`)) {
    throw new Error(`Asset points outside dist: ${relativePath}`);
  }

  const details = await stat(fullPath);
  if (!details.isFile() || details.size === 0) {
    throw new Error(`Built file is missing or empty: ${relativePath}`);
  }
}

async function gzipSize(relativePath) {
  return gzipSync(await readFile(path.join(distRoot, relativePath))).byteLength;
}

function requireWithinBudget(label, size, budget, relativePath) {
  if (size <= budget) return;
  throw new Error(`${label} exceeds gzip budget: ${relativePath} is ${size} bytes, budget is ${budget}`);
}

const html = await readFile(path.join(distRoot, 'index.html'), 'utf8');
const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g)].map((match) => match[1].slice(1));

if (assetPaths.length < 2) {
  throw new Error('Built index.html must reference JavaScript and CSS assets');
}

for (const assetPath of new Set(assetPaths)) {
  if (!/-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(assetPath)) {
    throw new Error(`Built asset is not content-hashed: ${assetPath}`);
  }
  await requireFile(assetPath);
  const size = await gzipSize(assetPath);
  if (assetPath.endsWith('.js')) requireWithinBudget('Entry JavaScript', size, budgets.entryJavaScriptGzip, assetPath);
  if (assetPath.endsWith('.css')) requireWithinBudget('Entry CSS', size, budgets.entryCssGzip, assetPath);
}

const builtAssets = await readdir(path.join(distRoot, 'assets'));
for (const assetName of builtAssets.filter((name) => name.endsWith('.js'))) {
  const relativePath = path.join('assets', assetName);
  requireWithinBudget('JavaScript chunk', await gzipSize(relativePath), budgets.anyJavaScriptGzip, relativePath);
}

await requireFile('manifest.webmanifest');
await requireFile('sw.js');

const serviceWorker = await readFile(path.join(distRoot, 'sw.js'), 'utf8');
for (const marker of ['cleanupOutdatedCaches', 'denylist', '/api', '/assets']) {
  if (!serviceWorker.includes(marker)) {
    throw new Error(`Service worker is missing deployment safeguard: ${marker}`);
  }
}

console.log(`Production build smoke and gzip budget checks passed for ${new Set(assetPaths).size} entry assets.`);
