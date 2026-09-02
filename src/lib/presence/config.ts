/**
 * Whether a cross-device backend has been configured.
 *
 * Both values are public by design: the URL is a hostname and the anon key is
 * meant to be shipped to browsers. What protects the data is Supabase's own
 * access rules, not the secrecy of this key — and presence carries nothing
 * worth protecting anyway (an anonymous id, an activity, a drink, a channel).
 *
 * Absent, the room falls back to the local adapter and remains honest: real
 * presence across tabs of one browser, and no invented company.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function hasSupabase(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
