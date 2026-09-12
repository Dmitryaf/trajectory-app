import { expect, test } from './fixtures';

for (const width of [1440, 390]) {
  test(`consent is optional and its action stays stable through grant and withdrawal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let enabled = false;
    let revision = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const operations: string[] = [];
    await page.route('**/functions/v1/product-events', async (route) => {
      const body = route.request().postDataJSON();
      operations.push(body.operation);
      if (body.operation === 'grant') {
        enabled = true;
        revision = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      }
      if (body.operation === 'withdraw') {
        enabled = false;
        revision = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      }
      await route.fulfill({ json: { enabled, revision, policy_version: 1, server_time: new Date().toISOString() } });
    });
    await page.goto('/');
    await expect(page.locator('.app-main')).toBeVisible();
    // Mount the production consent component with the real queue; only the external Edge response is simulated.
    await page.evaluate(async () => {
      const vuePath = '/node_modules/.vite/deps/vue.js';
      const componentPath = '/src/features/telemetry/ui/TelemetryConsent.vue';
      const telemetryPath = '/src/features/telemetry/productTelemetry.ts';
      const [{ createApp }, { default: component }, { productTelemetry }] = await Promise.all([
        import(vuePath),
        import(componentPath),
        import(telemetryPath),
      ]);
      const host = document.createElement('div');
      host.id = 'telemetry-test-host';
      host.style.cssText = 'max-width: 600px; margin: 20px auto; padding: 12px';
      document.getElementById('app')!.style.display = 'none';
      document.body.prepend(host);
      createApp(component).mount(host);
      productTelemetry.setSession('synthetic-account', 'synthetic-access-token');
    });
    const panel = page.locator('#telemetry-test-host');
    await panel.locator('summary').click();
    await expect(panel).toContainText('Сбор на этом устройстве выключен');
    expect(operations).not.toContain('grant');
    const grant = panel.getByRole('button', { name: 'Разрешить сбор событий' });
    await expect(grant).toBeEnabled();
    const initial = await grant.boundingBox();
    await grant.click();
    const withdraw = panel.getByRole('button', { name: 'Отозвать и удалить события' });
    await expect(withdraw).toBeEnabled();
    const allowed = await withdraw.boundingBox();
    expect(Math.abs(allowed!.y - initial!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(allowed!.height - initial!.height)).toBeLessThanOrEqual(1);
    await withdraw.click();
    await expect(panel).toContainText('персональные продуктовые события удалены с сервера');
    await expect(grant).toBeEnabled();
    const revoked = await grant.boundingBox();
    expect(Math.abs(revoked!.y - initial!.y)).toBeLessThanOrEqual(1);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(operations).toContain('withdraw');
  });
}
