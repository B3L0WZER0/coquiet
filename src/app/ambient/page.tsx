import type { Metadata } from "next";

import { Background } from "@/components/Background";
import { Room } from "@/components/Room";
import { roomForHour } from "@/lib/background";

const TITLE = "Ambient sounds for focus · Coquiet";
const DESCRIPTION =
  "Ocean waves, a forest in the wind and falling snow: calm ambient sound for deep work and study, with a focus timer and quiet company.";

// Named outright: an openGraph object here replaces the site's card rather than inheriting it.
const CARD = {
  url: "/opengraph-image.jpg",
  width: 1200,
  height: 630,
  alt: "Coquiet",
};

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ambient/" },
  openGraph: {
    type: "website",
    siteName: "Coquiet",
    title: TITLE,
    description: DESCRIPTION,
    url: "/ambient/",
    locale: "en",
    images: [CARD],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [CARD],
  },
};

/** The same room, opening on Ambient — an address to link and search for. */
export default function AmbientPage() {
  return (
    <>
      <Background buildRoom={roomForHour()} />
      <Room initialMode="ambient" />
    </>
  );
}
