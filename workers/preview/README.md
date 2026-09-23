# workers/preview

A private test copy of the site at `coquiet-preview.<account>.workers.dev`.

    npm run preview:deploy

builds the static export without Supabase (so testers never appear in the live
room's count), drops the local `/audio` copies from `.next-preview/` (the Worker reads
the music from the `coquiet-audio` bucket instead, same origin, as on
coquiet.app), and uploads it. Nothing here touches coquiet.app or GitHub Pages.

Every response is `noindex`: HTML via `_headers`, the music via the Worker.
