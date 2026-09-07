import type { Metadata, Viewport } from 'next';
import { Playfair_Display } from 'next/font/google';

import { roomChooserScript } from '@/lib/background';
import { SITE_URL } from '@/lib/site';

import './globals.css';

/** The one display face: the entry headline, and nothing else. */
const displaySerif = Playfair_Display({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

const TITLE = 'Coquiet — Focus quietly, together';
const DESCRIPTION =
  'Enter a beautiful shared room, choose your music and focus quietly alongside others.';

export const metadata: Metadata = {
  // Absolute by the time a crawler reads it: og:image and the canonical link
  // are resolved against this, and there is no page for them to fall back on.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'coquiet',
  // One page, one address. Anything reached with a ?room= on it is the same
  // room seen at a different hour, not a page of its own to index.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Coquiet',
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    locale: 'en',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: '#1a1713',
  // The room is one fixed viewport; nothing should rubber-band or zoom-jump.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * The one structured-data claim worth making: this address is Coquiet, it is a
 * free thing you use in a browser, and here is what it does. No breadcrumbs, no
 * ratings, no invented organisation.
 */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Coquiet',
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: 'ProductivityApplication',
  browserRequirements: 'Requires JavaScript.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={displaySerif.variable}>
      <body>
        {/* First thing in the document: it starts the room's photograph
            downloading before anything below it has been parsed. */}
        <script dangerouslySetInnerHTML={{ __html: roomChooserScript() }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
