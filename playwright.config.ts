import { defineConfig, devices } from '@playwright/test';

/**
 * The tests get their own server, on their own port, with no cross-device
 * presence backend.
 *
 * Both halves of that matter. The presence tests assert on an empty room —
 * "Room open" with no count, then exactly one person, then two — which is only
 * true if the room contains nothing but the pages the test opened. Pointed at
 * the Supabase backend, every real visitor to the live site counts too, so the
 * numbers were whatever the internet happened to be doing.
 *
 * Unsetting the two Supabase variables drops presence to the local
 * BroadcastChannel adapter, which never leaves the browser Playwright is
 * driving. The separate port is what makes that stick: on 3000 the config would
 * happily reuse a `npm run dev` already running from .env.local, and quietly
 * test against Supabase again.
 */
const PORT = 3100;
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: ORIGIN,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: ORIGIN,
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      // Empty, not absent: Next.js leaves an already-defined variable alone, so
      // this is what stops .env.local putting Supabase back.
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      // Next locks a dev server per dist dir, so this is what lets the suite
      // run without stopping the server you are developing in.
      NEXT_DIST_DIR: '.next-e2e',
    },
  },
});
