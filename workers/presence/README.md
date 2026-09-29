# The presence route

`coquiet.app/presence` is served by this Worker: one Durable Object, `Room`,
that holds every visitor's WebSocket and tells the room how many people are in
it. Everything else on the domain is still GitHub Pages and never touches it.

It exists to keep presence free. Supabase did this before, and its heartbeat —
an HTTP upsert per visitor every 15s, about 2 KB of egress each — reached
~740 MB a day and forced a paid plan. Here an open socket *is* the heartbeat, so
nothing is written per visitor per tick, and Cloudflare charges no egress.

## How it talks

One socket per visitor, on the page's own origin (nothing for a proxy to
strip, same as the music).

| From | Message | Meaning |
| --- | --- | --- |
| client | `{"t":"here","activity":…,"drink":…}` | count me, with this status (join and every change) |
| client | `{"t":"away"}` | stop counting me; keep watching |
| client | `ping` | still here — answered `pong` by the runtime without waking the object |
| server | `{"count":…,"activities":{…},"drinks":{…}}` | the rollup, on connect and whenever the room changes |

A socket that never says `here` is an observer: the entry screen watches the
room this way without joining it. Unknown values become `null`, and anything
over 256 bytes is ignored ([`src/tally.js`](src/tally.js)).

Three timings in [`src/index.js`](src/index.js) keep it cheap:

- **Changes settle for 2s** and go out as one rollup, so ten people arriving
  together cost one broadcast, not ten. An unchanged rollup is not resent.
- **A minute's alarm sweeps** sockets with no ping or message for 150s — a
  phone that fell asleep with the room open. The alarm only runs while someone
  is connected.
- **Sockets hibernate.** An idle room is billed no duration; pings do not wake
  it.

The rollup carries counts only. Per socket the object keeps the activity, the
drink and when it last heard from it, as the socket's attachment in memory —
nothing is written to storage, and it is gone when the socket closes.

## Deploying it

```bash
npm run presence:worker
```

`npx wrangler login` first if this Mac is not authenticated — as
**diego.beglinger@gmail.com**, the account that owns the `coquiet.app` zone
(see the traps below).

Then check it answers, from outside the browser:

```bash
npm run room
```

Want a line like `7:39:28 AM  3 here  ·  working 2  ·  coffee 1`. That is real
sessions only; the site adds the standing room on top.

## Running it locally

```bash
npx wrangler dev --local --port 8787
```

from this folder, then `NEXT_PUBLIC_PRESENCE_URL=ws://localhost:8787/presence`
in `.env.local` and restart `npm run dev`. `PRESENCE_URL=ws://localhost:8787/presence
npm run room` reads the local room. Take the variable out again afterwards:
with no Worker running, the room reports presence as unavailable. Unit tests
for the message handling and the tally are in
`tests/unit/presence-worker.test.ts`; they need no Worker.

## How it was stood up

Done on 2026-09-29. The zone was already proxied for the audio Worker, so the
route attached straight away.

1. **Deploy the Worker** and check it with `npm run room` before anything
   depends on it.
2. **Set the repository variable** `NEXT_PUBLIC_PRESENCE_URL` to `/presence`
   (Settings → Secrets and variables → Actions → Variables, or
   `gh variable set`). Unset, the build falls back to presence within one
   browser.
3. **Push**, so Pages rebuilds with it. The order matters: a build pointing at
   a Worker that isn't there shows the room as unavailable.

## Three things that will bite

**The wrong Cloudflare account fails as an auth error.** Wrangler logged in as
anyone but diego.beglinger@gmail.com gets `Authentication error [code: 10000]`
against account `bb75eca9…`, with no hint that it is the account, not the
token. `npx wrangler whoami` shows which one is active. `wrangler login` must
run in a terminal that stays open until the browser confirms — close it early
and it silently never finishes.

**Renaming or replacing `Room` needs a migration.** The class is declared in
`migrations` in `wrangler.jsonc` as `new_sqlite_classes` — SQLite-backed, the
kind the Workers Free plan allows. A rename needs a new migration tag
(`renamed_classes`), never an edit to `v1`.

**Only two origins get in.** The Worker refuses a socket whose `Origin` is not
`https://coquiet.app` or localhost, so another site can't open the room from a
visitor's browser. A preview on another hostname — the github.io copy
included — gets `403` and shows presence as unavailable. Add the origin in
`allowedOrigin()` if one ever needs it.

## Staying free

The Workers Free plan allows 100,000 Durable Object requests a day. A
connection is one request; client messages and alarms count too. That is
roughly several hundred people present all day. Watch it under Workers & Pages
→ coquiet-presence → Metrics; past it, Workers Paid is $5 a month. Don't add
anything that writes or broadcasts per visitor per tick — that is the cost this
Worker exists to avoid.
