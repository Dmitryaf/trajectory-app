import { createClient, isAuthRetryableFetchError, type AuthChangeEvent, type Session, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const betaSignupEnabled = import.meta.env.VITE_ENABLE_BETA_SIGNUP === 'true';
const cloudAuthRequired = import.meta.env.VITE_REQUIRE_AUTH === 'true';

let client: SupabaseClient | null = null;

export type CloudSnapshot = {
  payload: unknown;
  updatedAt: string;
  userId: string;
};

export type CloudSyncMeta = {
  lastCloudUpdatedAt: string;
  lastSyncedAt: string;
  pending: boolean;
  conflict: boolean;
  error: string;
};

const emptyMeta: CloudSyncMeta = {
  lastCloudUpdatedAt: '',
  lastSyncedAt: '',
  pending: false,
  conflict: false,
  error: '',
};

export function isCloudSyncConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function isCloudAuthRequired(): boolean {
  return cloudAuthRequired;
}

export function isBetaSignupConfigured(): boolean {
  return isCloudSyncConfigured() && betaSignupEnabled;
}

export function getSupabaseClient(): SupabaseClient {
  if (!isCloudSyncConfigured()) {
    throw new Error('Supabase не настроен');
  }

  client ??= createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

export async function getCloudSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getVerifiedCloudSession(): Promise<Session | null> {
  const session = await getCloudSession();
  if (!session) return null;

  const { error } = await getSupabaseClient().auth.getUser();
  if (error) throw error;

  return session;
}

export async function getStartupCloudSession(): Promise<Session | null> {
  const session = await getCloudSession();
  if (!session) return null;

  const { error } = await getSupabaseClient().auth.getUser();
  if (!error || isAuthRetryableFetchError(error)) return session;

  throw error;
}

export function onCloudAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  return getSupabaseClient().auth.onAuthStateChange((event, session) => callback(event, session));
}

export async function signInToCloud(email: string, password: string): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUpToCloud(
  email: string,
  password: string,
  inviteCode: string,
): Promise<{ session: Session | null; confirmationRequired: boolean }> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: { beta_invite_code: inviteCode },
    },
  });
  if (error) throw error;
  return { session: data.session, confirmationRequired: !data.session };
}

export async function requestCloudPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/password-reset`,
  });
  if (error) throw error;
}

export async function resendCloudSignupConfirmation(email: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw error;
}

export async function updateCloudPassword(password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw error;
}

export async function deleteCloudAccount(): Promise<void> {
  const { error } = await getSupabaseClient().functions.invoke('delete-account', {
    body: { confirmation: 'DELETE_MY_ACCOUNT' },
  });
  if (error) throw error;
}

export async function clearLocalCloudSession(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function signOutFromCloud(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function loadCloudSnapshot(): Promise<CloudSnapshot | null> {
  const session = await requireSession();
  const { data, error } = await getSupabaseClient()
    .from('trajectory_snapshots')
    .select('payload, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    payload: data.payload,
    updatedAt: data.updated_at,
    userId: session.user.id,
  };
}

export async function saveCloudSnapshot(payload: unknown): Promise<string> {
  const session = await requireSession();
  const updatedAt = new Date().toISOString();
  const { error } = await getSupabaseClient().from('trajectory_snapshots').upsert({
    user_id: session.user.id,
    payload,
    updated_at: updatedAt,
  });

  if (error) throw error;
  saveCloudSyncMeta(session.user.id, {
    lastCloudUpdatedAt: updatedAt,
    lastSyncedAt: new Date().toISOString(),
    pending: false,
    conflict: false,
    error: '',
  });
  return updatedAt;
}

export function getCloudSyncMeta(userId: string): CloudSyncMeta {
  try {
    const value = window.localStorage.getItem(cloudSyncMetaKey(userId));
    return value ? { ...emptyMeta, ...JSON.parse(value) } : { ...emptyMeta };
  } catch {
    return { ...emptyMeta };
  }
}

export function saveCloudSyncMeta(userId: string, patch: Partial<CloudSyncMeta>) {
  const next = { ...getCloudSyncMeta(userId), ...patch };
  window.localStorage.setItem(cloudSyncMetaKey(userId), JSON.stringify(next));
  return next;
}

export function markCloudSyncPending(userId: string, error: string) {
  return saveCloudSyncMeta(userId, {
    pending: true,
    error,
  });
}

export function markCloudSyncConflict(userId: string, cloudUpdatedAt: string) {
  return saveCloudSyncMeta(userId, {
    lastCloudUpdatedAt: cloudUpdatedAt,
    pending: false,
    conflict: true,
    error: '',
  });
}

export function markCloudSyncSynced(userId: string, cloudUpdatedAt: string) {
  return saveCloudSyncMeta(userId, {
    lastCloudUpdatedAt: cloudUpdatedAt,
    lastSyncedAt: new Date().toISOString(),
    pending: false,
    conflict: false,
    error: '',
  });
}

export function clearCloudSyncMeta(userId: string) {
  window.localStorage.removeItem(cloudSyncMetaKey(userId));
}

function cloudSyncMetaKey(userId: string) {
  return `trajectory:cloud-sync:${userId}`;
}

async function requireSession(): Promise<Session> {
  const session = await getVerifiedCloudSession();
  if (!session) throw new Error('Сначала войди в облачную копию');
  return session;
}
