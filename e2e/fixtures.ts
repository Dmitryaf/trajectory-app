import { expect, test as base, type ConsoleMessage } from '@playwright/test';

type BrowserErrorOptions = {
  allowedBrowserErrors: RegExp[];
};

export const test = base.extend<BrowserErrorOptions>({
  allowedBrowserErrors: [[], { option: true }],
  page: async ({ page, allowedBrowserErrors }, use, testInfo) => {
    const browserErrors: string[] = [];
    const recordConsoleError = (message: ConsoleMessage) => {
      if (message.type() === 'error') browserErrors.push(`console.error: ${message.text()}`);
    };

    page.on('console', recordConsoleError);
    page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

    await use(page);

    const unexpectedErrors = browserErrors.filter((message) => !allowedBrowserErrors.some((pattern) => pattern.test(message)));
    if (!unexpectedErrors.length) return;

    await testInfo.attach('unexpected-browser-errors.txt', {
      body: unexpectedErrors.join('\n'),
      contentType: 'text/plain',
    });
    expect(unexpectedErrors, 'Unexpected browser errors were reported').toEqual([]);
  },
});

export { expect };
export type { Page } from '@playwright/test';
