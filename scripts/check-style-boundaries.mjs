import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import stylelint from 'stylelint';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const styleEntry = 'src/style.css';
const targetGlobalStyles = new Set(['src/styles/tokens.css', 'src/styles/reset.css', 'src/styles/base.css', 'src/styles/utilities.css']);
const allowedUtilityClasses = new Set(['visually-hidden']);
const legacyGlobalStyleBudgets = new Map([
  ['src/styles/base.css', { classes: 1, blocks: 18 }],
  ['src/styles/responsive-desktop.css', { classes: 0, blocks: 0 }],
  ['src/styles/responsive-mobile.css', { classes: 0, blocks: 3 }],
  ['src/styles/responsive-small.css', { classes: 0, blocks: 2 }],
]);

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

function countGlobalStructure(source) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return {
    classes: withoutComments.match(/\.[_a-z][\w-]*/gi)?.length ?? 0,
    blocks: withoutComments.match(/\{/g)?.length ?? 0,
  };
}

function classNames(source) {
  return [...source.matchAll(/\.([_a-z][\w-]*)/gi)].map((match) => match[1]);
}

function validateStyleEntry(source, violations) {
  const imports = new Set();
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
    if (!targetGlobalStyles.has(importedFile) && !legacyGlobalStyleBudgets.has(importedFile)) {
      violations.push(`${styleEntry}:${index + 1}: ${importedFile} is outside the target and legacy global style lists.`);
    }
    if (imports.has(importedFile)) {
      violations.push(`${styleEntry}:${index + 1}: duplicate global style import ${importedFile}.`);
    }
    imports.add(importedFile);
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
  const current = countGlobalStructure(source);
  const budget = legacyGlobalStyleBudgets.get(relative);

  if (!targetGlobalStyles.has(relative) && !budget) {
    violations.push(`${relative}: global file is outside the target and legacy style lists; move it next to its scoped owner.`);
    continue;
  }

  if (!budget) {
    validateTargetGlobalStyle(relative, source, violations);
    continue;
  }

  for (const metric of ['classes', 'blocks']) {
    if (current[metric] > budget[metric]) {
      violations.push(
        `${relative}: global ${metric} count grew from ${budget[metric]} to ${current[metric]}; move the rule to a scoped owner.`,
      );
    } else if (current[metric] < budget[metric]) {
      violations.push(`${relative}: global ${metric} count fell from ${budget[metric]} to ${current[metric]}; lower its boundary budget.`);
    }
  }
}

for (const file of legacyGlobalStyleBudgets.keys()) {
  if (!observedGlobalStyles.has(file)) {
    violations.push(`${file}: file from the global style boundary budget was not found.`);
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
