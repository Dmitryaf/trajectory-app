import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export type CloudSnapshot = {
  payload: unknown;
  updatedAt: string;
};

export function isCloudSyncConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
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

export function onCloudAuthChange(callback: (session: Session | null) => void) {
  return getSupabaseClient().auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signInToCloud(email: string, password: string): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUpToCloud(email: string, password: string): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw error;
  return data.session;
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
  };
}

export async function saveCloudSnapshot(payload: unknown): Promise<string> {
  const session = await requireSession();
  const updatedAt = new Date().toISOString();
  const { error } = await getSupabaseClient()
    .from('trajectory_snapshots')
    .upsert({
      user_id: session.user.id,
      payload,
      updated_at: updatedAt,
    });

  if (error) throw error;
  return updatedAt;
}

async function requireSession(): Promise<Session> {
  const session = await getCloudSession();
  if (!session) throw new Error('Сначала войди в облачную копию');
  return session;
}
