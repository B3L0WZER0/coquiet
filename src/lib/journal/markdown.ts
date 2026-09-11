/**
 * The small slice of Markdown the journal is written in: paragraphs, ## and ###
 * headings, lists, **bold**, *italic*, links, `>` for the "try this" box (a
 * leading **Label:** becomes its heading) and `>>` for a pull quote.
 * Posts are ours, so this favours being readable over being complete.
 */

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text: string, base: string): string {
  return escape(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) =>
      href.startsWith('/')
        ? `<a href="${base}${href}">${label}</a>`
        : `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/** `base` prefixes internal links, so they survive a base path. */
export function renderMarkdown(source: string, base = ''): string {
  return source
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim());
      if (lines.every((l) => l.startsWith('>>'))) {
        const text = lines.map((l) => l.replace(/^>>\s?/, '')).join(' ');
        return `<blockquote class="journal-pull"><p>${inline(text, base)}</p></blockquote>`;
      }
      if (lines.every((l) => l.startsWith('>'))) {
        let inner = lines.map((l) => l.replace(/^>\s?/, '')).join('\n');
        const label = /^\*\*([^*]+?):\*\*\s*/.exec(inner);
        if (label) inner = inner.slice(label[0].length);
        const heading = label ? `<p class="journal-try-label">${escape(label[1])}</p>` : '';
        return `<aside class="journal-try">${heading}${renderMarkdown(inner, base)}</aside>`;
      }
      if (block.startsWith('### ')) return `<h3>${inline(block.slice(4).trim(), base)}</h3>`;
      if (block.startsWith('## ')) return `<h2>${inline(block.slice(3).trim(), base)}</h2>`;
      if (lines.every((l) => /^[-*]\s/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''), base)}</li>`).join('')}</ul>`;
      }
      if (lines.every((l) => /^\d+\.\s/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s+/, ''), base)}</li>`).join('')}</ol>`;
      }
      return `<p>${inline(lines.join(' '), base)}</p>`;
    })
    .join('\n');
}

/** Rough minutes to read, at an unhurried pace. */
export function readingMinutes(source: string): number {
  const words = source.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

/** "The one-line morning: a gentle way…" → a title and its subtitle. */
export function splitTitle(title: string): { head: string; sub: string | null } {
  const at = title.indexOf(': ');
  if (at < 0) return { head: title, sub: null };
  const rest = title.slice(at + 2);
  return { head: title.slice(0, at), sub: `${rest[0].toUpperCase()}${rest.slice(1)}.` };
}
