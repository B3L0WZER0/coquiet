import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notify } from '@/lib/notifications';

/** A stand-in for the browser's Notification, which jsdom does not implement. */
class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static shown: FakeNotification[] = [];

  onclick: (() => void) | null = null;
  closed = false;

  constructor(
    public title: string,
    public options: NotificationOptions = {},
  ) {
    FakeNotification.shown.push(this);
  }

  close() {
    this.closed = true;
  }
}

/** jsdom reports 'visible' and offers no way to set it. */
function look(where: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    get: () => where,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('timer notifications', () => {
  beforeEach(() => {
    FakeNotification.shown = [];
    FakeNotification.permission = 'granted';
    vi.stubGlobal('Notification', FakeNotification);
    vi.spyOn(window, 'focus').mockImplementation(() => {});
    look('hidden');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    look('visible');
  });

  it('carries the room’s mark and replaces its own last message', () => {
    notify('Time for a break', 'Take ten.');
    const [note] = FakeNotification.shown;
    expect(note.options.icon).toContain('/icon-192.png');
    expect(note.options.tag).toBe('coquiet-timer');
    // Silent: the chime is the sound, and it has already rung.
    expect(note.options.silent).toBe(true);
  });

  it('takes down the previous banner before showing another', () => {
    notify('Time for a break', 'Take ten.');
    notify('Welcome back', 'The room is ready.');
    expect(FakeNotification.shown).toHaveLength(2);
    expect(FakeNotification.shown[0].closed).toBe(true);
    expect(FakeNotification.shown[1].closed).toBe(false);
  });

  it('brings the room back when the banner is clicked', () => {
    notify('Time for a break', 'Take ten.');
    const [note] = FakeNotification.shown;
    note.onclick?.();
    expect(window.focus).toHaveBeenCalled();
    expect(note.closed).toBe(true);
  });

  it('clears itself when the visitor comes back on their own', () => {
    notify('Time for a break', 'Take ten.');
    const [note] = FakeNotification.shown;
    look('visible');
    expect(note.closed).toBe(true);
  });

  it('says nothing to a visitor who is already looking at the room', () => {
    look('visible');
    notify('Time for a break', 'Take ten.');
    expect(FakeNotification.shown).toHaveLength(0);
  });

  it('says nothing without permission', () => {
    FakeNotification.permission = 'denied';
    notify('Time for a break', 'Take ten.');
    expect(FakeNotification.shown).toHaveLength(0);
  });
});
