/** The presence Worker: `/presence` in production, a full ws:// URL for a
 *  local `wrangler dev`. Unset, presence stays within one browser. */
export const PRESENCE_URL = process.env.NEXT_PUBLIC_PRESENCE_URL ?? '';

/** `off` drops the standing room, so tests can count real sessions exactly. */
export const BASELINE_ENABLED = process.env.NEXT_PUBLIC_PRESENCE_BASELINE !== 'off';

export function hasPresenceServer(): boolean {
  return PRESENCE_URL.length > 0;
}
