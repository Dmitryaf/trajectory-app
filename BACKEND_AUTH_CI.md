# Backend, auth and CI/CD

## Current state

The deployed Vercel URL is public, but the app data is still local to each browser through IndexedDB. A visitor can open the app and create their own local records, but they cannot change another browser profile's local data.

Cloud data changes the threat model. Once records are stored outside the browser, every cloud table must be protected by authentication and Row Level Security.

The production app uses an auth gate when Supabase environment variables are configured. Local IndexedDB data is loaded only after a verified Supabase session exists. The local cache is also bound to the current Supabase `user.id`; if another user signs in on the same browser, the previous local cache is cleared before the app loads.

The default deployment exposes sign-in only. A closed beta can enable self-registration, but the frontend flag is only presentation: the server-side `Before User Created` hook must require the beta invitation code and enforce the participant limit before Supabase signup is enabled.

## Chosen first backend layer

The first backend layer uses Supabase:

- Supabase Auth for email/password sign-in.
- Postgres table `trajectory_snapshots` for one cloud JSON snapshot per user.
- Row Level Security policies where `auth.uid()` must match `user_id`.
- The app remains offline-first; IndexedDB is the local cache and Supabase stores the user's cloud snapshot.
- The public Vercel URL opens the sign-in screen first, not the tracker UI.
- When an authenticated browser has an empty local cache, the app tries to bootstrap it from the user's cloud snapshot.
- Local changes are saved to IndexedDB first, then the app tries to update the cloud snapshot.
- If cloud save fails, the local data remains available and the app marks sync as pending.
- If the local cache and cloud snapshot both contain data and the app cannot prove they are the same lineage, it marks a conflict and asks the user to choose manually.
- Importing a JSON backup while signed in updates the cloud snapshot after the local import succeeds.

This is intentionally simpler than normalizing every entity into separate tables. It preserves the current analytics code and reduces migration risk. A normalized schema can be added later when multi-device conflict resolution, server-side analytics, or collaboration becomes necessary.

IndexedDB is still relevant in this phase. Supabase is not yet the primary per-record database for daily entries, results, events, and reviews; it stores one protected snapshot per user. Removing IndexedDB before implementing per-record sync would break offline use and increase the risk of data loss or conflicts.

The safety rule is that the app never silently overwrites non-empty local data with a different non-empty cloud snapshot. Empty local cache can be filled from cloud automatically. A known stale local cache can be refreshed from cloud automatically. Unknown divergence becomes an explicit conflict.

The next backend phase, when needed, should make Supabase the source of truth with normalized tables, `updated_at` fields per record, RLS policies per table, explicit conflict rules, and automatic sync from the local cache.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Apply every migration from `supabase/migrations` while new-user signup remains disabled.
4. Create the owner's account in Supabase Authentication.
5. Keep new-user sign-ups disabled unless the closed beta procedure below has been completed.
6. Open Project Settings -> API.
7. Copy:
   - Project URL
   - anon public key
6. Add them to Vercel Project Settings -> Environment Variables:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The anon key is allowed in the frontend. It is not a database master key. Security comes from RLS policies, not from hiding the anon key.

Never put `service_role` in the frontend or in `VITE_*` variables.

## Closed beta self-registration

The beta flow lets invited people create their own email/password account. Do these steps in order for staging first:

1. Keep `Allow new users to sign up` disabled and `VITE_ENABLE_BETA_SIGNUP=false`.
2. Apply `20260723000000_add_beta_signup_gate.sql`.
3. Configure a unique code and the participant limit in SQL Editor. Do not save the code in the repository, Vercel variables, logs or screenshots:

```sql
select private.configure_beta_signup('replace-with-a-long-random-code', 15, true);
```

4. In Authentication Hooks, enable `Before User Created` with `public.hook_require_beta_invite`.
5. Configure the correct Site URL and redirect URLs, keep email confirmation enabled, and configure SMTP before inviting several people at once.
6. Review Auth rate limits. Do not enable CAPTCHA until a compatible challenge is added to the frontend; the invite hook remains the beta access boundary.
7. Enable `Allow new users to sign up` in Supabase.
8. Set `VITE_ENABLE_BETA_SIGNUP=true` only for the matching Vercel environment and redeploy.
9. Verify invalid code, valid signup, email confirmation, first login, password recovery and RLS isolation.

The invitation code is checked before account creation and removed from stored user metadata by a database trigger. The hook stops after the configured number of successful signup attempts. Changing the code resets this counter.

To stop enrollment immediately, disable it server-side; a frontend deployment is not required:

```sql
select private.configure_beta_signup('', 15, false);
```

Then turn off `Allow new users to sign up` and remove `VITE_ENABLE_BETA_SIGNUP` during the next deployment.

## Vercel

After adding environment variables, redeploy the target environment. Vercel is connected to GitHub: `main` creates production deployments, while pull requests and non-production branches create Preview deployments. The persistent `develop` staging branch must use a separate Supabase project and branch-specific Preview variables.

The app also has `vercel.json` so Vue history routes like `/week`, `/month`, and `/trends` resolve to `index.html`.

## CI/CD

GitHub Actions runs on pull requests to `develop` or `main` and on pushes to those protected branches:

```text
npm ci
npm run check
```

Vercel handles CD:

- Pull requests get preview deployments.
- `develop` provides persistent staging with isolated Preview variables.
- Merges to `main` get production deployments.

The full branch, protection, staging, release and hotfix procedure is documented in [docs/DELIVERY.md](./docs/DELIVERY.md).

## Operational rule

Before using cloud restore, download a local JSON backup. The cloud restore intentionally replaces the local IndexedDB state with the saved cloud snapshot.

If using a shared computer, sign out after use. Signing out hides the app and clears in-memory state, but browser-level security still depends on the device and browser profile being trustworthy.
