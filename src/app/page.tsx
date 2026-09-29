import { Background } from '@/components/Background';
import { Room } from '@/components/Room';
import { RoomChooser } from '@/components/RoomChooser';
import { roomForHour } from '@/lib/background';

/** Prerendered. */
export default function Page() {
  return (
    <>
      <RoomChooser />
      <Background buildRoom={roomForHour()} />
      <Room />
    </>
  );
}
