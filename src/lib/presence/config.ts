/** Whether a cross-device backend has been configured. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** `off` drops the standing room, so tests can count real sessions exactly. */
export const BASELINE_ENABLED = process.env.NEXT_PUBLIC_PRESENCE_BASELINE !== 'off';

export function hasSupabase(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
