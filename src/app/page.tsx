import { Background } from '@/components/Background';
import { Room } from '@/components/Room';
import { roomForHour } from '@/lib/background';

/** Prerendered. */
export default function Page() {
  return (
    <>
      <Background buildRoom={roomForHour()} />
      <Room />
    </>
  );
}
