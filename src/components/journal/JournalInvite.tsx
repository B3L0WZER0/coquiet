import { ArrowUpRight } from '@/components/journal/Arrows';
import { RoomPicture } from '@/components/journal/RoomPicture';
import { assetPath } from '@/lib/asset-path';

/** The way back into the room, over one of its photographs. */
export function JournalInvite({ variant = 'stacked' }: { variant?: 'stacked' | 'row' }) {
  return (
    <aside className={`journal-invite journal-invite-${variant}`} aria-label="The room">
      <RoomPicture roomId="architecture-fireplace-lake" alt="" sizes="(min-width: 64rem) 64rem, 100vw" className="journal-invite-photo" />
      <div className="journal-invite-text">
        <p className="journal-invite-title">The room is open.</p>
        <p>Instrumental music, a gentle timer, and quiet company while you work.</p>
      </div>
      {/* A full page load: the room picks its photograph before it paints. */}
      <a href={assetPath('/')} className="journal-pill journal-pill-solid">
        Visit the room <ArrowUpRight />
      </a>
    </aside>
  );
}
