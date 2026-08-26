import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const rawColorPattern = /#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi;
const rawColorOwnerFiles = new Set(['src/styles/tokens.css']);
const colorBudgets = new Map([
  ['src/styles/archive.css', 3],
  ['src/styles/auth.css', 38],
  ['src/styles/base.css', 38],
  ['src/styles/daily-form.css', 16],
  ['src/styles/journal.css', 16],
  ['src/styles/month-layout.css', 3],
  ['src/styles/period-navigation.css', 7],
  ['src/styles/primitives.css', 13],
  ['src/styles/responsive-desktop.css', 0],
  ['src/styles/responsive-mobile.css', 2],
  ['src/styles/responsive-small.css', 0],
  ['src/styles/reviews.css', 46],
  ['src/styles/settings.css', 16],
  ['src/styles/shell.css', 9],
  ['src/styles/today.css', 7],
  ['src/styles/trend-details.css', 51],
  ['src/styles/trends.css', 53],
  ['src/App.css', 37],
  ['src/features/analysis/ui/ExternalAnalysisSettingsCard.vue', 1],
  ['src/features/auth/ui/AccountMenu.vue', 15],
  ['src/features/auth/ui/AccountSettingsCard.vue', 2],
  ['src/features/daily-entry/ui/CurrentGoalDialog.vue', 1],
  ['src/features/feedback/ui/FeedbackDialog.vue', 1],
  ['src/features/first-use/ui/FirstUseRecovery.css', 32],
  ['src/features/first-use/ui/HowItWorksDialog.vue', 8],
  ['src/features/experiments/ui/ExperimentSettingsCard.vue', 1],
  ['src/features/journal/ui/ArchiveDateRange.vue', 5],
  ['src/features/journal/ui/ArchivePagination.vue', 1],
  ['src/features/pwa/ui/PwaInstallGuide.vue', 5],
  ['src/features/pwa/ui/PwaInstallNudge.vue', 6],
  ['src/features/reviews/ui/DecisionFollowUp.vue', 4],
  ['src/features/reviews/ui/PeriodRecordCard.vue', 4],
  ['src/features/reviews/ui/WeeklyReviewOverview.vue', 3],
  ['src/features/reviews/ui/WeeklyReviewJournalLinks.vue', 5],
  ['src/shared/ui/content/ClampedText.vue', 2],
  ['src/shared/ui/branding/BrandMark.vue', 3],
  ['src/shared/ui/data-display/MetricCard.vue', 4],
  ['src/shared/ui/forms/ChipGroup.vue', 7],
  ['src/shared/ui/forms/ScalePicker.vue', 4],
  ['src/shared/ui/navigation/PeriodNavigator.vue', 4],
  ['src/shared/ui/overlays/DialogCloseButton.vue', 1],
  ['src/views/SettingsView.css', 17],
  ['src/views/TodayView.css', 77],
  ['src/views/EventsView.css', 14],
  ['src/views/MoreView.css', 15],
  ['src/views/ResultsView.css', 9],
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

function styleSource(file, source) {
  if (file.endsWith('.css')) {
    return source;
  }
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join('\n');
}

const sourceFiles = await collectFiles(sourceRoot);
const files = sourceFiles
  .filter((file) => file.endsWith('.css') || file.endsWith('.vue'))
  .map(projectPath)
  .sort();
const violations = [];
const observedFiles = new Set();

for (const file of files) {
  const source = styleSource(file, await readFile(path.join(root, file), 'utf8'));
  if (!source && !colorBudgets.has(file)) {
    continue;
  }
  observedFiles.add(file);
  const rawColorCount = source.match(rawColorPattern)?.length ?? 0;
  if (rawColorOwnerFiles.has(file)) {
    continue;
  }
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
  console.log(`Style color guard passed for ${observedFiles.size} style owners.`);
}
