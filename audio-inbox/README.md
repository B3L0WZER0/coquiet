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

## Two things --apply does not do

**Upload to R2.** The manifest builds from local files; playback serves from
audio.coquiet.app. A track that never reaches the bucket 404s for every listener.

**Keep the station clock still.** Adding to a channel changes its cycle length,
so on deploy every listener's position in the programme jumps once.

Nothing in here is committed except this README.
