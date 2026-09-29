import { describe, expect, it } from 'vitest';

import { parseMessage, tally } from '../../workers/presence/src/tally.js';

describe('presence worker', () => {
  it('reads here and away, and ignores anything else', () => {
    expect(parseMessage('{"t":"here","activity":"reading","drink":"tea"}')).toEqual({
      activity: 'reading',
      drink: 'tea',
    });
    expect(parseMessage('{"t":"away"}')).toBeNull();
    expect(parseMessage('ping')).toBeUndefined();
    expect(parseMessage('{"t":"shout"}')).toBeUndefined();
    expect(parseMessage('x'.repeat(1000))).toBeUndefined();
  });

  it('drops values the room does not offer', () => {
    expect(parseMessage('{"t":"here","activity":"<b>","drink":"nothing"}')).toEqual({
      activity: null,
      drink: null,
    });
  });

  it('counts people, not observers', () => {
    const r = tally([
      null,
      { activity: 'working', drink: 'coffee' },
      { activity: 'working', drink: null },
      { activity: null, drink: 'tea' },
    ]);
    expect(r.count).toBe(3);
    expect(r.activities.working).toBe(2);
    expect(r.drinks).toEqual({ coffee: 1, tea: 1, water: 0 });
  });
});
