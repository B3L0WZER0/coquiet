import { roomChooserScript } from '@/lib/background';

/** First thing on a room page: starts the room's photograph downloading before
 *  anything below it has been parsed. Only the pages that show a room carry
 *  it — on the journal it was three quarters of every page, unused. */
export function RoomChooser() {
  return <script dangerouslySetInnerHTML={{ __html: roomChooserScript() }} />;
}
