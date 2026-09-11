# workers/journal

Answers `coquiet.app/api/journal/votes/<slug>` — the journal's "This helped"
button. GET reads `{ count, voted }`, POST votes, DELETE takes it back.
Everything else on the zone is still GitHub Pages.

```bash
npx wrangler d1 execute coquiet-journal --remote --file workers/journal/schema.sql
npx wrangler secret put VOTE_SALT --config workers/journal/wrangler.jsonc
npm run journal:worker
```

`VOTE_SALT` is any long random string. Changing it forgets who voted (counts
stay), so set it once. Without it the Worker answers 503 and the button stays
hidden.
