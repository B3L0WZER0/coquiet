import { describe, expect, it } from 'vitest';

import { readingMinutes, renderMarkdown } from '@/lib/journal/markdown';
import { getPosts, parsePost } from '@/lib/journal/posts';

describe('journal markdown', () => {
  it('renders the blocks posts use', () => {
    const html = renderMarkdown('## A heading\n\nSome **bold** and *soft* words.\n\n- one\n- two\n\n1. first\n2. second');
    expect(html).toContain('<h2>A heading</h2>');
    expect(html).toContain('<p>Some <strong>bold</strong> and <em>soft</em> words.</p>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(html).toContain('<ol><li>first</li><li>second</li></ol>');
  });

  it('turns a quote into the "try this" aside', () => {
    expect(renderMarkdown('> **Try this:** one line.')).toBe(
      '<aside class="journal-try"><p><strong>Try this:</strong> one line.</p></aside>',
    );
  });

  it('prefixes internal links with the base path and opens external ones apart', () => {
    expect(renderMarkdown('[room](/)', '/coquiet')).toContain('href="/coquiet/"');
    expect(renderMarkdown('[x](https://example.com)')).toContain('rel="noopener noreferrer"');
  });

  it('escapes HTML in the source', () => {
    expect(renderMarkdown('a <script> tag')).toBe('<p>a &lt;script&gt; tag</p>');
  });

  it('estimates reading time', () => {
    expect(readingMinutes('word '.repeat(660))).toBe(3);
    expect(readingMinutes('short')).toBe(1);
  });
});

describe('journal posts', () => {
  const posts = getPosts();

  it('has distinct slugs that are safe in a URL', () => {
    expect(posts.length).toBeGreaterThan(0);
    for (const p of posts) expect(p.slug).toMatch(/^[a-z0-9-]+$/);
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
  });

  it('gives search engines a description that fits a result snippet', () => {
    for (const p of posts) {
      expect(p.description.length, p.slug).toBeGreaterThanOrEqual(70);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(165);
    }
  });

  it('links only to posts that exist', () => {
    const slugs = new Set(posts.map((p) => p.slug));
    for (const p of posts) {
      for (const [, slug] of p.body.matchAll(/\]\(\/journal\/([^)]+)\)/g)) {
        expect(slugs.has(slug), `${p.slug} → ${slug}`).toBe(true);
      }
    }
  });

  it('refuses a post whose room does not exist', () => {
    const src = '---\ntitle: T\ndescription: D\ndate: 2026-01-01\nroom: nowhere\nalt: A\n---\nBody';
    expect(() => parsePost('01-x.md', src)).toThrow(/no room/);
  });
});
