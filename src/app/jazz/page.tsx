import type { Metadata } from "next";

import { Background } from "@/components/Background";
import { Room } from "@/components/Room";
import { RoomChooser } from "@/components/RoomChooser";
import { roomForHour } from "@/lib/background";

const TITLE = "Jazz café music for focus: a rainy Japanese kissa · Coquiet";
const DESCRIPTION =
  "Slow jazz in a Japanese coffee house on a rainy evening: piano, soft guitar and brushed drums for deep work and study, with a focus timer. No account needed.";

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
  alternates: { canonical: "/jazz/" },
  openGraph: {
    type: "website",
    siteName: "Coquiet",
    title: TITLE,
    description: DESCRIPTION,
    url: "/jazz/",
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

/** The same room, opening on Jazz — an address to link and search for. */
export default function JazzPage() {
  return (
    <>
      <RoomChooser />
      <Background buildRoom={roomForHour()} />
      <Room initialMode="jazz" />
    </>
  );
}
