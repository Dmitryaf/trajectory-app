import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const distRoot = path.join(projectRoot, 'dist');

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

const html = await readFile(path.join(distRoot, 'index.html'), 'utf8');
const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g)]
  .map((match) => match[1].slice(1));

if (assetPaths.length < 2) {
  throw new Error('Built index.html must reference JavaScript and CSS assets');
}

for (const assetPath of new Set(assetPaths)) {
  if (!/-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(assetPath)) {
    throw new Error(`Built asset is not content-hashed: ${assetPath}`);
  }
  await requireFile(assetPath);
}

await requireFile('manifest.webmanifest');
await requireFile('sw.js');

const serviceWorker = await readFile(path.join(distRoot, 'sw.js'), 'utf8');
for (const marker of ['cleanupOutdatedCaches', 'denylist', '/api', '/assets']) {
  if (!serviceWorker.includes(marker)) {
    throw new Error(`Service worker is missing deployment safeguard: ${marker}`);
  }
}

console.log(`Production build smoke check passed for ${new Set(assetPaths).size} entry assets.`);
