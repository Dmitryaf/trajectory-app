import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const rawColorPattern = /#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi;
const rawColorOwnerFiles = new Set(['src/styles/tokens.css']);
const colorBudgets = new Map([
  ['src/styles/base.css', 38],
  ['src/styles/responsive-desktop.css', 0],
  ['src/styles/responsive-mobile.css', 0],
  ['src/styles/responsive-small.css', 0],
  ['src/App.css', 37],
  ['src/features/analytics/ui/EventComparisonDetails.css', 29],
  ['src/features/analytics/ui/HistoryOverviewCard.vue', 3],
  ['src/features/analytics/ui/HistoryRangeTabs.vue', 3],
  ['src/features/analytics/ui/HistoryTimeline.vue', 13],
  ['src/features/analytics/ui/TrendMetricDetails.vue', 2],
  ['src/features/analysis/ui/ExternalAnalysisSettingsCard.vue', 0],
  ['src/features/auth/ui/AccountMenu.vue', 15],
  ['src/features/auth/ui/AccountSettingsCard.vue', 7],
  ['src/features/auth/ui/AuthGate.css', 33],
  ['src/features/daily-entry/ui/CurrentGoalDialog.vue', 1],
  ['src/features/feedback/ui/FeedbackDialog.vue', 1],
  ['src/features/first-use/ui/FirstUseRecovery.css', 32],
  ['src/features/first-use/ui/HowItWorksDialog.vue', 8],
  ['src/features/experiments/ui/ExperimentSettingsCard.vue', 2],
  ['src/features/journal/ui/ArchiveDateRange.vue', 5],
  ['src/features/journal/ui/ArchivePage.vue', 21],
  ['src/features/journal/ui/ArchivePagination.vue', 1],
  ['src/features/pwa/ui/PwaInstallGuide.vue', 7],
  ['src/features/settings/ui/SettingsCard.css', 8],
  ['src/features/pwa/ui/PwaInstallNudge.vue', 6],
  ['src/features/reviews/ui/DecisionFollowUp.vue', 4],
  ['src/features/reviews/ui/MetricSwitcher.vue', 5],
  ['src/features/reviews/ui/PeriodAnalysisCard.vue', 1],
  ['src/features/reviews/ui/PeriodDetails.vue', 1],
  ['src/features/reviews/ui/PeriodPill.vue', 3],
  ['src/features/reviews/ui/PeriodRecordCard.vue', 8],
  ['src/features/reviews/ui/ReviewCueGrid.vue', 12],
  ['src/features/reviews/ui/ReviewNotice.vue', 1],
  ['src/features/reviews/ui/ReviewPageHeading.vue', 8],
  ['src/features/reviews/ui/WeeklyRhythmCard.vue', 10],
  ['src/features/reviews/ui/WeeklyReviewOverview.vue', 3],
  ['src/features/reviews/ui/WeeklyReviewJournalLinks.vue', 5],
  ['src/shared/ui/actions/IconActionButton.vue', 2],
  ['src/shared/ui/actions/ActionButton.css', 7],
  ['src/shared/ui/actions/UtilityTriggerButton.vue', 6],
  ['src/shared/ui/charts/EChartPanel.vue', 4],
  ['src/shared/ui/content/ClampedText.vue', 3],
  ['src/shared/ui/content/DataNote.css', 1],
  ['src/shared/ui/content/PeriodEmptyGuide.vue', 3],
  ['src/shared/ui/content/ReviewNudge.vue', 4],
  ['src/shared/ui/data-display/CountBadge.vue', 2],
  ['src/shared/ui/branding/BrandMark.vue', 3],
  ['src/shared/ui/data-display/MetricCard.vue', 4],
  ['src/shared/ui/forms/ChipGroup.vue', 7],
  ['src/shared/ui/forms/DateInput.vue', 1],
  ['src/shared/ui/forms/FormCardHeading.vue', 13],
  ['src/shared/ui/forms/FormDisclosure.vue', 2],
  ['src/shared/ui/forms/FormFieldLabel.vue', 2],
  ['src/shared/ui/forms/ScalePicker.vue', 4],
  ['src/shared/ui/navigation/PeriodNavigator.vue', 4],
  ['src/shared/ui/layout/SurfaceCard.css', 2],
  ['src/shared/ui/navigation/RangeTabs.css', 4],
  ['src/shared/ui/overlays/DialogCloseButton.vue', 1],
  ['src/shared/ui/overlays/DialogSurface.vue', 2],
  ['src/views/SettingsView.css', 21],
  ['src/views/TodayView.css', 77],
  ['src/views/EventsView.css', 6],
  ['src/views/MonthView.css', 25],
  ['src/views/MoreView.css', 15],
  ['src/views/PasswordResetView.css', 5],
  ['src/views/ResultsView.css', 6],
  ['src/views/WeekView.css', 46],
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
