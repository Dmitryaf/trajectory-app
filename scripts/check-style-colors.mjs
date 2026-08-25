import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const stylesRoot = path.join(root, 'src', 'styles');
const rawColorPattern = /#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi;
const colorBudgets = new Map([
  ['src/styles/archive.css', 30],
  ['src/styles/auth.css', 41],
  ['src/styles/base.css', 38],
  ['src/styles/daily-form.css', 58],
  ['src/styles/first-use.css', 32],
  ['src/styles/journal.css', 39],
  ['src/styles/month-layout.css', 3],
  ['src/styles/period-navigation.css', 11],
  ['src/styles/primitives.css', 13],
  ['src/styles/responsive-desktop.css', 0],
  ['src/styles/responsive-mobile.css', 4],
  ['src/styles/responsive-small.css', 0],
  ['src/styles/reviews.css', 66],
  ['src/styles/settings.css', 49],
  ['src/styles/shell.css', 50],
  ['src/styles/today.css', 67],
  ['src/styles/trend-details.css', 51],
  ['src/styles/trends.css', 53],
]);

const files = (await readdir(stylesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
  .map((entry) => `src/styles/${entry.name}`)
  .sort();
const violations = [];
const observedFiles = new Set();

for (const file of files) {
  observedFiles.add(file);
  const source = await readFile(path.join(root, file), 'utf8');
  const rawColorCount = source.match(rawColorPattern)?.length ?? 0;
  const budget = colorBudgets.get(file) ?? 0;

  if (rawColorCount > budget) {
    violations.push(`${file}: raw color count grew from ${budget} to ${rawColorCount}; use a semantic token instead.`);
  } else if (rawColorCount < budget) {
    violations.push(`${file}: raw color count fell from ${budget} to ${rawColorCount}; lower its budget.`);
  }
}

for (const file of colorBudgets.keys()) {
  if (!observedFiles.has(file)) {
    violations.push(`${file}: file from the style color budget was not found.`);
  }
}

if (violations.length > 0) {
  console.error(['Style color guard failed:', ...violations.map((violation) => `- ${violation}`)].join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Style color guard passed for ${files.length} files.`);
}
