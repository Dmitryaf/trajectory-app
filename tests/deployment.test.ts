import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelConfig {
  rewrites: Array<{ source: string; destination: string }>;
  headers: Array<{ source: string; headers: VercelHeader[] }>;
}

const config = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
) as VercelConfig;

const appRoutes = ['/week', '/month', '/trends', '/more', '/results', '/events', '/settings', '/password-reset'];
const betaSignupMigration = readFileSync(new URL('../supabase/migrations/20260723000000_add_beta_signup_gate.sql', import.meta.url), 'utf8');
const deleteAccountFunction = readFileSync(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8');
const feedbackFunction = readFileSync(new URL('../api/feedback.ts', import.meta.url), 'utf8');
const cloudSyncService = readFileSync(new URL('../src/services/cloudSync.ts', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

function cacheControlFor(source: string): string | undefined {
  return config.headers
    .find((rule) => rule.source === source)
    ?.headers.find((header) => header.key.toLowerCase() === 'cache-control')
    ?.value;
}

describe('deployment configuration', () => {
  it('rewrites only known SPA routes to index.html', () => {
    expect(config.rewrites).toEqual(
      appRoutes.map((source) => ({ source, destination: '/index.html' }))
    );
  });

  it('does not contain a catch-all rewrite that can mask missing assets', () => {
    const wildcardMarkers = ['*', '(', ')', ':', '[', ']'];
    expect(config.rewrites.some((rule) => wildcardMarkers.some((marker) => rule.source.includes(marker)))).toBe(false);
    expect(config.rewrites.some((rule) => rule.source.startsWith('/assets') || rule.source.startsWith('/api'))).toBe(false);
  });

  it('keeps hashed assets immutable', () => {
    expect(cacheControlFor('/assets/(.*)')).toBe('public, max-age=31536000, immutable');
  });

  it.each(['/sw.js', '/manifest.webmanifest'])('revalidates %s on every request', (source) => {
    expect(cacheControlFor(source)).toBe('public, max-age=0, must-revalidate');
  });

  it('keeps beta signup limited by a server-side hook', () => {
    expect(betaSignupMigration).toContain('hook_require_beta_invite');
    expect(betaSignupMigration).toContain('signup_count >= config.max_signups');
    expect(betaSignupMigration).toContain("- 'beta_invite_code'");
    expect(betaSignupMigration).not.toContain('service_role');
  });

  it('supports fail-closed preview deployments without backend credentials', () => {
    expect(envExample).toContain('VITE_REQUIRE_AUTH=false');
    expect(envExample).toContain('VITE_FEEDBACK_ENABLED=false');
    expect(cloudSyncService).toContain("import.meta.env.VITE_REQUIRE_AUTH === 'true'");
  });

  it('keeps feedback delivery credentials and recipient on the server', () => {
    expect(feedbackFunction).toContain('process.env.FEEDBACK_TO_EMAIL');
    expect(feedbackFunction).toContain('process.env.RESEND_API_KEY');
    expect(feedbackFunction).toContain('/auth/v1/user');
    expect(feedbackFunction).not.toContain('import.meta.env');
  });

  it('deletes only the authenticated caller through a server-side function', () => {
    expect(deleteAccountFunction).toContain('auth.getUser(accessToken)');
    expect(deleteAccountFunction).toContain("body.confirmation !== 'DELETE_MY_ACCOUNT'");
    expect(deleteAccountFunction).toContain('auth.admin.deleteUser(user.id)');
    expect(deleteAccountFunction).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(cloudSyncService).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
