import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The music is the one asset heavy enough to need its own host. These pin the
 * two shapes that has to take: served beside the site, or served from a bucket.
 */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import('@/lib/asset-path');
}

describe('where assets are served from', () => {
  const saved = { ...process.env };

  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env = { ...saved };
  });

  it('serves the music beside the site when no host is set', async () => {
    const m = await load({ NEXT_PUBLIC_BASE_PATH: '/coquiet', NEXT_PUBLIC_AUDIO_BASE_URL: undefined });
    expect(m.audioPath('/audio/Still%201.mp3')).toBe('/coquiet/audio/Still%201.mp3');
    expect(m.audioIsOffOrigin).toBe(false);
  });

  it('sends the music to its own host, dropping the /audio prefix', async () => {
    const m = await load({
      NEXT_PUBLIC_BASE_PATH: '',
      NEXT_PUBLIC_AUDIO_BASE_URL: 'https://audio.example.com',
    });
    expect(m.audioPath('/audio/Still%201.mp3')).toBe('https://audio.example.com/Still%201.mp3');
    // The engine reads this to decide whether the decks need CORS. Getting it
    // wrong costs iOS its sound and says nothing about why.
    expect(m.audioIsOffOrigin).toBe(true);
  });

  it('does not care whether the host was given a trailing slash', async () => {
    const m = await load({
      NEXT_PUBLIC_BASE_PATH: '',
      NEXT_PUBLIC_AUDIO_BASE_URL: 'https://audio.example.com/',
    });
    expect(m.audioPath('/audio/Still%201.mp3')).toBe('https://audio.example.com/Still%201.mp3');
  });

  it('leaves the site base path alone either way', async () => {
    const m = await load({
      NEXT_PUBLIC_BASE_PATH: '/coquiet',
      NEXT_PUBLIC_AUDIO_BASE_URL: 'https://audio.example.com',
    });
    expect(m.assetPath('/images/room-640.avif')).toBe('/coquiet/images/room-640.avif');
  });
});
