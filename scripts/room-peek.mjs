/** Who is in the room right now, read from the presence Worker.
 *
 *  Observes without announcing, so running this never adds anyone to the
 *  count. The count is real sessions only — the site adds the standing room on
 *  top (src/lib/presence/baseline.ts).
 *
 *    npm run room            one snapshot, then exit
 *    npm run room -- --watch keep printing as the room changes
 *    PRESENCE_URL=ws://localhost:8787/presence npm run room   a local Worker
 */

const url = process.env.PRESENCE_URL ?? 'wss://coquiet.app/presence';
const watch = process.argv.includes('--watch');

// The Worker refuses other origins; claim the site's own.
const origin = url.startsWith('wss://coquiet.app') ? 'https://coquiet.app' : 'http://localhost:3000';
const socket = new WebSocket(url, { headers: { Origin: origin } });

socket.onmessage = ({ data }) => {
  if (data === 'pong') return;
  const room = JSON.parse(data);
  const list = (counts) =>
    Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ') || '—';
  console.log(
    `${new Date().toLocaleTimeString()}  ${room.count} here  ·  ${list(room.activities)}  ·  ${list(room.drinks)}`,
  );
  if (!watch) socket.close();
};

socket.onerror = () => {
  console.error(`Could not reach ${url}`);
  process.exit(1);
};

if (watch) setInterval(() => socket.send('ping'), 30_000);
