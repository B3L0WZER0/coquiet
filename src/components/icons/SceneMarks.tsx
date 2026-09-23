/** Line marks for the three ambient scenes, drawn to the dock marks' weight. */

import type { AmbientId } from '@/lib/ambient';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Frame({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  );
}

/** Two swells, the lower one longer. */
function WaveMark({ size }: { size: number }) {
  return (
    <Frame size={size}>
      <path d="M3 8.6c1.5-1.5 2.9-1.5 4.4 0s2.9 1.5 4.4 0 2.9-1.5 4.4 0" {...stroke} />
      <path d="M3 12.6c1.5-1.5 2.9-1.5 4.4 0s2.9 1.5 4.4 0 2.9-1.5 4.4 0" {...stroke} />
    </Frame>
  );
}

/** A fir: three tiers and a trunk. */
function TreeMark({ size }: { size: number }) {
  return (
    <Frame size={size}>
      <path d="M10 3.2 6.9 7.6h2l-3 4.1h2.4l-2.9 3.9h9.2l-2.9-3.9h2.4l-3-4.1h2L10 3.2Z" {...stroke} />
      <path d="M10 15.6v1.9" {...stroke} />
    </Frame>
  );
}

/** Three gusts, curling at their ends. */
function WindMark({ size }: { size: number }) {
  return (
    <Frame size={size}>
      <path d="M3 7.4h8.6a2 2 0 1 0-2-2" {...stroke} />
      <path d="M3 10.4h11.4a2.1 2.1 0 1 1-2.1 2.1" {...stroke} />
      <path d="M3 13.4h5.2" {...stroke} />
    </Frame>
  );
}

export function SceneMark({ id, size = 16 }: { id: AmbientId; size?: number }) {
  if (id === 'coast') return <WaveMark size={size} />;
  if (id === 'forest') return <TreeMark size={size} />;
  return <WindMark size={size} />;
}
