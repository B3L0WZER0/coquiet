import { Background } from '@/components/Background';
import { Room } from '@/components/Room';
import { roomById } from '@/lib/background';

/**
 * Rendered per request so the room can follow the clock.
 *
 * Prerendered at build time it would freeze on whichever hour the build ran in
 * and never turn over. The page has no data to fetch, so rendering it per
 * request costs almost nothing — and it guarantees that everyone arriving in
 * the same hour is given the same room, which is the point.
 */
export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  // `?room=<id>` picks one deliberately, and only in development — see roomById.
  const { room: requested } = await searchParams;
  const room = roomById(requested);

  return (
    <>
      <Background room={room} />
      <Room />
    </>
  );
}
