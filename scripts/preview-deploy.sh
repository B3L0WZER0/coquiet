#!/bin/sh
# Builds a static export for the preview Worker and deploys it. See
# workers/preview/README.md. Never touches coquiet.app.
set -eu
cd "$(dirname "$0")/.."

# Empty, not absent: Next leaves an already-defined variable alone, so this
# is what keeps .env.local's Supabase keys out of the preview.
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH="" \
  NEXT_PUBLIC_SUPABASE_URL="" NEXT_PUBLIC_SUPABASE_ANON_KEY="" \
  NEXT_PUBLIC_CF_BEACON_TOKEN="" NEXT_PUBLIC_AUDIO_BASE_URL="" \
  NEXT_DIST_DIR=.next-preview \
  npx next build

# The export lands in the dist dir here, not out/. The music comes from R2 through the Worker; the local copies are too big to
# upload and would shadow it.
rm -rf .next-preview/audio
# Finder litter copied over from public/.
find .next-preview -name .DS_Store -delete
printf '/*\n  X-Robots-Tag: noindex\n' > .next-preview/_headers

npx wrangler deploy --config workers/preview/wrangler.jsonc
