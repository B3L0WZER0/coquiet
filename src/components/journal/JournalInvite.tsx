import { ArrowUpRight } from '@/components/journal/Arrows';
import { Picture } from '@/components/journal/Picture';
import { RoomOfTheHour } from '@/components/journal/RoomOfTheHour';
import { assetPath } from '@/lib/asset-path';
import type { RoomMode } from '@/lib/channels';
import { scenePhoto } from '@/lib/journal/photos';

/** The way back into the room, over the photograph it is showing right now. */
export function JournalInvite({
  variant = 'stacked',
  door = 'music',
}: {
  variant?: 'stacked' | 'row';
  door?: RoomMode;
}) {
  const ambient = door === 'ambient';
  return (
    <aside
      className={`journal-invite journal-invite-${variant}`}
      aria-label={ambient ? 'The ambient room' : 'The focus room'}
    >
      {ambient ? (
        // Green, not Blue: the first sound post's own photo is the coast.
        <Picture
          photo={scenePhoto('forest')}
          alt=""
          sizes="(min-width: 64rem) 64rem, 100vw"
          className="journal-invite-photo"
        />
      ) : (
        <RoomOfTheHour />
      )}
      <div className="journal-invite-text">
        <p className="journal-invite-title">The room is open.</p>
        <p>
          {ambient
            ? 'The sound of the sea, a forest or falling snow, a gentle timer, and quiet company.'
            : 'Instrumental music, a gentle timer, and quiet company while you work.'}
        </p>
      </div>
      {/* A full page load: the room picks its photograph before it paints. */}
      <a href={assetPath(ambient ? '/ambient/' : '/')} className="journal-pill journal-pill-solid">
        {ambient ? 'Visit the ambient room' : 'Visit the focus room'} <ArrowUpRight />
      </a>
    </aside>
  );
}
