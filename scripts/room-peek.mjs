/** Who is in the room right now, read from Supabase Realtime.
 *
 *  Observes without tracking, so running this never adds anyone to the count.
 *  Node has no BroadcastChannel, so anything this sees genuinely crossed the
 *  network — unlike two tabs of the same browser, which prove nothing.
 *
 *    npm run room            one snapshot, then exit
 *    npm run room -- --watch keep printing as the room changes
 */

import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
if (!url || !key) {
  console.error('No Supabase config. Copy .env.local.example to .env.local.');
  process.exit(1);
}

const ROOM = 'coquiet:room';
const EXPIRY_MS = 75_000; // mirrors live() in src/lib/presence/aggregate.ts
const watch = process.argv.includes('--watch');

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const channel = client.channel(ROOM);

function report() {
  const state = channel.presenceState();
  const now = Date.now();
  const rows = [];
  for (const [connection, entries] of Object.entries(state)) {
    for (const e of entries) {
      rows.push({ connection, ...e, age: now - (e.at ?? 0) });
    }
  }
  const live = rows.filter((r) => r.age < EXPIRY_MS);
  const stale = rows.length - live.length;

  console.log(`\n${new Date().toLocaleTimeString()} — ${ROOM}`);
  if (live.length === 0) {
    console.log('  room empty');
  } else {
    console.log(`  ${live.length} ${live.length === 1 ? 'person' : 'people'} here`);
    for (const r of live) {
      const bits = [r.channel, r.activity ?? '—', r.drink ?? '—'].join(' · ');
      console.log(`    ${r.id.slice(0, 8)}  ${bits}  ${Math.round(r.age / 1000)}s ago`);
    }
  }
  if (stale > 0) console.log(`  (${stale} expired, not counted)`);
  console.log(`  ${Object.keys(state).length} connections tracked`);
}

channel.on('presence', { event: 'sync' }, () => {
  if (watch) report();
});

channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    if (watch) {
      console.log('watching — ctrl-c to stop');
      report();
    } else {
      // One sync arrives right after subscribing; give it a moment to land.
      setTimeout(() => {
        report();
        process.exit(0);
      }, 1500);
    }
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    console.error(`connection ${status}`);
    process.exit(1);
  }
});
