# Backend, auth and CI/CD

## Current state

The deployed Vercel URL is public, but the app data is still local to each browser through IndexedDB. A visitor can open the app and create their own local records, but they cannot change another browser profile's local data.

Cloud data changes the threat model. Once records are stored outside the browser, every cloud table must be protected by authentication and Row Level Security.

## Chosen first backend layer

The first backend layer uses Supabase:

- Supabase Auth for email/password sign-in.
- Postgres table `trajectory_snapshots` for one cloud JSON snapshot per user.
- Row Level Security policies where `auth.uid()` must match `user_id`.
- The app remains offline-first; cloud sync is a manual backup/restore action.

This is intentionally simpler than normalizing every entity into separate tables. It preserves the current analytics code and reduces migration risk. A normalized schema can be added later when multi-device conflict resolution, server-side analytics, or collaboration becomes necessary.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/trajectory_snapshots.sql`.
4. Open Project Settings -> API.
5. Copy:
   - Project URL
   - anon public key
6. Add them to Vercel Project Settings -> Environment Variables:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The anon key is allowed in the frontend. It is not a database master key. Security comes from RLS policies, not from hiding the anon key.

Never put `service_role` in the frontend or in `VITE_*` variables.

## Vercel

After adding environment variables, redeploy production. Vercel is already connected to GitHub, so pushes to `main` create production deployments.

The app also has `vercel.json` so Vue history routes like `/week`, `/month`, and `/trends` resolve to `index.html`.

## CI/CD

GitHub Actions runs on pull requests and pushes to `main`:

```text
npm ci
npm test -- --run
npm run build
```

Vercel handles CD:

- Pull requests get preview deployments.
- Merges or pushes to `main` get production deployments.

## Operational rule

Before using cloud restore, download a local JSON backup. The cloud restore intentionally replaces the local IndexedDB state with the saved cloud snapshot.
