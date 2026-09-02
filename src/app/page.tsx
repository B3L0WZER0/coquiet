import { Background } from '@/components/Background';
import { Room } from '@/components/Room';
import { roomForHour } from '@/lib/background';

/**
 * Prerendered.
 *
 * The room follows the clock, so this page used to render per request. A
 * static export has no request to render on — so the hour is read in the
 * browser instead, and what is baked in here is only the room of the hour the
 * build ran in. `Background` corrects it on mount if the visitor arrives in a
 * later one. See the note there.
 */
export default function Page() {
  return (
    <>
      <Background buildRoom={roomForHour()} />
      <Room />
    </>
  );
}
