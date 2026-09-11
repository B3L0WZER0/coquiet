/**
 * Journal posts, read from content/journal at build time.
 *
 * One Markdown file per post. The filename (minus its number prefix) is the
 * post's permanent URL; the number only orders posts published the same day.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { BASE_PATH } from '@/lib/asset-path';
import { ROOMS } from '@/lib/background';
import { readingMinutes, renderMarkdown, splitTitle } from '@/lib/journal/markdown';

export interface Post {
  slug: string;
  /** The full title: the page <title>, and what search results show. */
  title: string;
  /** The title as set on the page — split at its colon. */
  head: string;
  sub: string | null;
  description: string;
  /** One short line for cards. */
  summary: string;
  category: string;
  /** YYYY-MM-DD */
  date: string;
  /** A room id from the background manifest — the post's photograph. */
  room: string;
  alt: string;
  keywords: string[];
  minutes: number;
  html: string;
  /** The raw Markdown, for checks that read the source. */
  body: string;
}

const DIR = path.join(process.cwd(), 'content/journal');
const REQUIRED = ['title', 'description', 'summary', 'category', 'date', 'room', 'alt'] as const;

export function parsePost(file: string, source: string): Post {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source.replace(/\r\n/g, '\n'));
  if (!match) throw new Error(`${file}: missing front matter`);

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const key of REQUIRED) {
    if (!meta[key]) throw new Error(`${file}: front matter needs "${key}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date must be YYYY-MM-DD`);
  if (!ROOMS.some((r) => r.id === meta.room)) throw new Error(`${file}: no room "${meta.room}"`);

  const body = match[2];
  const { head, sub } = splitTitle(meta.title);
  return {
    slug: file.replace(/^\d+-/, '').replace(/\.md$/, ''),
    title: meta.title,
    head,
    sub,
    description: meta.description,
    summary: meta.summary,
    category: meta.category,
    date: meta.date,
    room: meta.room,
    alt: meta.alt,
    keywords: (meta.keywords ?? '').split(',').map((k) => k.trim()).filter(Boolean),
    minutes: readingMinutes(body),
    html: renderMarkdown(body, BASE_PATH),
    body,
  };
}

/** Newest first; same-day posts in file order. */
export function getPosts(): Post[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => parsePost(f, readFileSync(path.join(DIR, f), 'utf8')))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((p) => p.slug === slug);
}

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
