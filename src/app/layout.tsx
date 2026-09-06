import type { Metadata, Viewport } from 'next';
import { Playfair_Display } from 'next/font/google';

import './globals.css';

/** The one display face: the entry headline, and nothing else. */
const displaySerif = Playfair_Display({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Coquiet — Focus quietly, together',
  description:
    'Enter a beautiful shared room, choose your music and focus quietly alongside others.',
  applicationName: 'coquiet',
};

export const viewport: Viewport = {
  themeColor: '#1a1713',
  // The room is one fixed viewport; nothing should rubber-band or zoom-jump.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={displaySerif.variable}>
      <body>{children}</body>
    </html>
  );
}
