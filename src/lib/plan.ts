/**
 * Planning a session and inviting someone to it. Nothing is stored or sent:
 * the invite is a link, and the plan is a calendar event the visitor keeps.
 */

/** Two hours — four 25/5 rounds or two 50/10 rounds, exactly. */
export const PLAN_MINUTES = 120;

const HOUR = 60 * 60 * 1000;

/** Sessions start no earlier than this and no later than the last start. */
const FIRST_START_HOUR = 7;
const LAST_START_HOUR = 20;

export interface Slot {
  start: Date;
  /** Today or tomorrow — the time is formatted by the UI in the visitor's locale. */
  day: 'today' | 'tomorrow';
}

function at(base: Date, dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Up to three sensible starts: later today, same time tomorrow, tomorrow morning. */
export function suggestedSlots(now: Date): Slot[] {
  const slots: Slot[] = [];

  // Later today: the next full hour at least 45 minutes out, so there is time to get there.
  const later = new Date(now.getTime() + 45 * 60 * 1000 + HOUR - 1);
  later.setMinutes(0, 0, 0);
  if (
    later.getDate() === now.getDate() &&
    later.getHours() >= FIRST_START_HOUR &&
    later.getHours() <= LAST_START_HOUR
  ) {
    slots.push({ start: later, day: 'today' });
  }

  // Same time tomorrow, on the half hour — the habit-forming one.
  const hour = Math.min(Math.max(now.getHours(), FIRST_START_HOUR), LAST_START_HOUR);
  const minute = hour === now.getHours() && now.getMinutes() >= 30 ? 30 : 0;
  const candidates = [at(now, 1, hour, minute), at(now, 1, 9), at(now, 1, 14)];

  for (const start of candidates) {
    if (slots.length === 3) break;
    if (slots.some((s) => s.start.getTime() === start.getTime())) continue;
    slots.push({ start, day: 'tomorrow' });
  }
  return slots;
}

/** The room itself, without any query or fragment. */
export function roomLink(location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}`;
}

const TITLE = 'Focus session - Coquiet';

function details(link: string): string {
  return `Two hours of quiet company in Coquiet.\nOpen the room: ${link}\n\nWorking with a friend? Add them as a guest.`;
}

/** Calendar UTC stamp: 20260915T130000Z. */
export function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function planEnd(start: Date): Date {
  return new Date(start.getTime() + PLAN_MINUTES * 60 * 1000);
}

export function googleCalendarUrl(start: Date, link: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    dates: `${utcStamp(start)}/${utcStamp(planEnd(start))}`,
    details: details(link),
    location: link,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** RFC 5545 folds at 75 octets; the text here is ASCII, so characters will do. */
function fold(line: string): string {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) parts.push(line.slice(i, i + 74));
  return parts.join('\r\n ');
}

/** An .ics file for Apple Calendar, Outlook and anything else. */
export function icsFile(start: Date, link: string, now: Date, uid: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Coquiet//Plan a session//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@coquiet.app`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(planEnd(start))}`,
    `SUMMARY:${escapeText(TITLE)}`,
    `DESCRIPTION:${escapeText(details(link))}`,
    `LOCATION:${escapeText(link)}`,
    `URL:${link}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Coquiet in 10 minutes',
    'TRIGGER:-PT10M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
