/** Optional desktop notifications for timer transitions. */

import { assetPath } from '@/lib/asset-path';

/** The room's mark, beside the message. Chrome and Firefox show it; Safari
 *  ignores it and reaches for the site's own icon instead, which is the same
 *  drawing — so the banner looks like the room either way. */
const ICON = '/icon-192.png';

/** One timer notification at a time. Someone who stepped away for an hour
 *  should come back to the message that is true now, not a stack of the ones
 *  that were true on the way here. */
const TAG = 'coquiet-timer';

/** The banner on screen, and the listener waiting for the visitor's return. */
let showing: { note: Notification; stop: () => void } | null = null;

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Whether the visitor is somewhere other than this room.
 *
 * Not the same question as "is the tab hidden". Chrome and Edge keep a tab
 * `visible` for as long as it is the front tab of a window that isn't
 * minimised — including while the whole browser sits behind whatever the
 * visitor actually went off to do. Asking about visibility alone therefore
 * stays quiet in precisely the case the notification exists for. Focus is the
 * honest signal: the room can be on screen and still not be the thing being
 * looked at.
 */
function away(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.visibilityState !== 'visible') return true;
  return typeof document.hasFocus === 'function' && !document.hasFocus();
}

/** Ask once, at the only moment it makes sense to. */
export async function requestOnDeliberateStart(): Promise<void> {
  if (!supported()) return;
  if (Notification.permission !== 'default') return;
  try {
    await Notification.requestPermission();
  } catch {
    // Some browsers reject this outside a user gesture; the timer works either
    // way, so there is nothing to recover from.
  }
}

/** Take down whatever is on screen and stop watching for the visitor. */
function dismiss(): void {
  if (!showing) return;
  const { note, stop } = showing;
  showing = null;
  stop();
  note.close();
}

/** Show a notification, if the visitor granted permission and is looking elsewhere. */
export function notify(title: string, body: string): void {
  if (!supported()) return;
  if (Notification.permission !== 'granted') return;
  if (!away()) return;

  dismiss();
  try {
    const note = new Notification(title, {
      body,
      silent: true,
      icon: assetPath(ICON),
      tag: TAG,
    });

    // Back in the room is the only place this banner could sensibly lead.
    note.onclick = () => {
      window.focus();
      dismiss();
    };

    // Coming back under your own steam answers the message just as well as
    // clicking it. Leaving it behind in Notification Center would not. Both
    // events matter: returning to the tab, and returning to the window that
    // never stopped showing it.
    const onReturn = () => {
      if (!away()) dismiss();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    showing = {
      note,
      stop: () => {
        document.removeEventListener('visibilitychange', onReturn);
        window.removeEventListener('focus', onReturn);
      },
    };
  } catch {
    // Notification construction throws on some mobile browsers; ignore.
  }
}
