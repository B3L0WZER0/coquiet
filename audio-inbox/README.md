# audio-inbox

Drop raw music files here — any format ffmpeg reads (m4a, mp3, wav, flac, aiff,
opus). Say which channel in the filename:

    still - some piano thing.wav
    flow - whatever it was called.mp3
    momentum - track 4.flac

Then:

    npm run audio:intake            # measure everything, change nothing
    npm run audio:intake -- --apply # encode, tag, name, file, regenerate the manifest

`--channel=flow` sets the channel for a whole batch instead of per filename.

## Why you pick the channel and not the script

The intake measures brightness, loudness range and low-band rhythmic movement,
and prints them beside what each channel already spans. It does not choose from
them. An earlier version did: leave-one-out over the filed programme placed 5 of
8 correctly, because those measures genuinely do not separate these channels —
Momentum 3 moves less in the low band than Flow 1, Still 2 has a wider dynamic
range than any Flow track. The difference between Still, Flow and Momentum is
musical, and ffmpeg cannot hear it.

## What --apply does

Normalises to the programme's mean loudness, encodes to 64k AAC LC / 44.1 kHz
stereo to match the filed tracks, tags title and artist, names it as the next
free slot in the channel, moves it into public/audio, and regenerates
src/lib/audio-manifest.ts. Your raw file stays here, renamed `.filed`.

Once a track is uploaded and live, its master moves to `archive/` under its
channel name. Keep them: the filed track is 64k AAC encoded from these, so any
future re-encode — a new bitrate, a different loudness target, another codec —
starts here rather than from a download.

## Uploading

`--apply` finishes by pushing public/audio to the R2 bucket the room streams
from. That needs rclone configured once:

    brew install rclone
    rclone config

Answer `n` for a new remote, name it `r2`, choose storage `s3`, provider
`Cloudflare`, and paste the access key and secret from the Cloudflare dashboard
(R2 -> Manage API tokens). The endpoint is
`https://<account-id>.r2.cloudflarestorage.com`. Leave region blank.

The prompts mask the secret, which is why this is worth doing interactively
rather than as one `rclone config create` line that lands in shell history.

If rclone was not ready when a track was filed, nothing is lost — push it later:

    npm run audio:upload

That is `copy`, never `sync`: public/audio is gitignored, so on a fresh clone it
can be empty, and `sync` would delete the live programme off the bucket. Files
already in the bucket are skipped, so a routine run never re-pushes the library.
Re-encoded a track under a name that is already up there? `--force-upload`.

`--no-upload` files a track without pushing it.

## Order matters at the end

Upload, *then* commit `src/lib/audio-manifest.ts`. The manifest is what tells
every browser the track exists; committing it first deploys a programme that
404s until the audio catches up.

## One thing nothing can avoid

Adding to a channel changes its cycle length, so on deploy every listener's
position in that programme jumps once.

Nothing in here is committed except this README.
