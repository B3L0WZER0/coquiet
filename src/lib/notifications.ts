/** Optional desktop notifications for timer transitions. */

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
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

/** Show a notification, if the visitor granted permission and is looking elsewhere. */
export function notify(title: string, body: string): void {
  if (!supported()) return;
  if (Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
  try {
    new Notification(title, { body, silent: true });
  } catch {
    // Notification construction throws on some mobile browsers; ignore.
  }
}
