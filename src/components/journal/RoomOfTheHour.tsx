'use client';

import { useEffect, useState } from 'react';

import { Picture } from '@/components/journal/Picture';
import { roomForHour } from '@/lib/background';
import { roomPhoto, type Photo } from '@/lib/journal/photos';

/**
 * The room the app is showing this hour. Chosen in the browser: the page was
 * built at some other hour, and would otherwise always show that one.
 */
export function RoomOfTheHour() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  useEffect(() => setPhoto(roomPhoto(roomForHour().id)), []);

  // Same box either way, so the photograph arriving shifts nothing.
  if (!photo) return <div className="journal-picture journal-invite-photo" aria-hidden="true" />;
  return (
    <Picture
      photo={photo}
      alt=""
      sizes="(min-width: 64rem) 64rem, 100vw"
      className="journal-invite-photo journal-fade-in"
    />
  );
}
