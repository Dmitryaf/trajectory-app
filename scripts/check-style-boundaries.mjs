import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import stylelint from 'stylelint';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const styleEntry = 'src/style.css';
const targetGlobalStyleOrder = ['src/styles/tokens.css', 'src/styles/reset.css', 'src/styles/base.css', 'src/styles/utilities.css'];
const targetGlobalStyles = new Set(targetGlobalStyleOrder);
const allowedUtilityClasses = new Set(['visually-hidden']);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function classNames(source) {
  return [...source.matchAll(/\.([_a-z][\w-]*)/gi)].map((match) => match[1]);
}

function validateStyleEntry(source, violations) {
  const imports = [];
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const [index, line] of withoutComments.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }
    const match = line.match(/^\s*@import\s+['"]\.\/styles\/([^'"]+\.css)['"];\s*$/);
    if (!match) {
      violations.push(`${styleEntry}:${index + 1}: the global entry may contain only imports from ./styles/.`);
      continue;
    }
    const importedFile = `src/styles/${match[1]}`;
    if (!targetGlobalStyles.has(importedFile)) {
      violations.push(`${styleEntry}:${index + 1}: ${importedFile} is outside the global foundation.`);
    }
    if (imports.includes(importedFile)) {
      violations.push(`${styleEntry}:${index + 1}: duplicate global style import ${importedFile}.`);
    }
    imports.push(importedFile);
  }

  if (imports.join('\n') !== targetGlobalStyleOrder.join('\n')) {
    violations.push(`${styleEntry}: imports must be exactly ${targetGlobalStyleOrder.join(', ')} in this order.`);
  }
}

function validateTargetGlobalStyle(relative, source, violations) {
  const classes = classNames(source);
  if (relative !== 'src/styles/utilities.css') {
    if (classes.length > 0) {
      violations.push(`${relative}: target foundation files may not contain class selectors.`);
    }
    return;
  }

  const unapprovedClasses = new Set(classes.filter((className) => !allowedUtilityClasses.has(className)));
  for (const className of unapprovedClasses) {
    violations.push(`${relative}: .${className} is not an approved global utility.`);
  }
}

const files = await collectFiles(sourceRoot);
const violations = [];
const observedGlobalStyles = new Set();
validateStyleEntry(await readFile(path.join(root, styleEntry), 'utf8'), violations);

for (const filePath of files.filter((file) => file.endsWith('.css'))) {
  const relative = projectPath(filePath);
  if (!relative.startsWith('src/styles/')) {
    continue;
  }
  observedGlobalStyles.add(relative);
  const source = await readFile(filePath, 'utf8');

  if (!targetGlobalStyles.has(relative)) {
    violations.push(`${relative}: global file is outside the foundation; move it next to its scoped owner.`);
    continue;
  }

  validateTargetGlobalStyle(relative, source, violations);
}

for (const file of targetGlobalStyles) {
  if (!observedGlobalStyles.has(file)) {
    violations.push(`${file}: required global foundation file was not found.`);
  }
}

for (const filePath of files.filter((file) => file.endsWith('.vue'))) {
  const relative = projectPath(filePath);
  const source = await readFile(filePath, 'utf8');
  const styleBlocks = [...source.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)];

  for (const [index, styleBlock] of styleBlocks.entries()) {
    const attributes = styleBlock[1] ?? '';
    if (!/\b(?:scoped|module)\b/i.test(attributes)) {
      violations.push(`${relative}: style block ${index + 1} must use scoped or module ownership.`);
    }

    const result = await stylelint.lint({
      code: styleBlock[2] ?? '',
      codeFilename: `${relative}.style-${index + 1}.css`,
      configFile: path.join(root, 'stylelint.config.js'),
    });
    for (const warning of result.results.flatMap((item) => item.warnings)) {
      violations.push(`${relative}:${warning.line}:${warning.column}: ${warning.text}`);
    }
  }
}

if (violations.length > 0) {
  console.error(['Style boundary guard failed:', ...violations.map((violation) => `- ${violation}`)].join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Style boundary guard passed for ${observedGlobalStyles.size} global files and scoped Vue styles.`);
}
