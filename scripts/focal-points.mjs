/**
 * The per-room crop points, shared by `assets:images` (which bakes them into
 * the manifest) and `assets:crops` (which renders the tiles you pick them from).
 */

/**
 * Where to centre the crop when the viewport is portrait.
 *
 * A phone shows a narrow vertical slice of a 16:9 frame, so which part it lands
 * on has to be chosen by eye — there is nothing to derive it from. These were
 * picked by rendering every image at several focal points and choosing the one
 * that keeps the room legible, favouring frames where a person is visible.
 *
 * Anything not listed defaults to the middle, which is rarely right.
 */
export const FOCAL_X = {
  'alpine-lake-studio': 68,
  // Framed on the desk the figure fell behind the headline and the barn read
  // as empty, so this takes the meadow and the cloud on the slope instead.
  'alpine-meadow-workspace': 72,
  'architecture-canyon': 73,
  'architecture-fireplace-lake': 65,
  'cafe-concrete-hall': 50,
  'cafe-garden-door': 68,
  'cafe-windows': 32,
  'calm-ocean-screen': 65,
  'calm-screen-working': 43,
  // The reader under the rock overhang, rather than the canyon window and the
  // shelves at the far end.
  'canyon-reading-room': 25,
  // No person in frame; centred on the lamp and the shelf above the bench.
  'cave-forest': 70,
  'cave-working': 65,
  'circular-window-studio': 65,
  'cliff-cave': 50,
  'cliffside-cafe-focus': 68,
  'coastal-grotto-writer': 60,
  'coastal-observatory': 74,
  'coffee-lake-mountain-view': 45,
  'coffee-lake-view': 61,
  'concrete-cave': 63,
  'desert-arches': 42,
  // Two other figures are further out; the reader in the chair sits next to the
  // courtyard tree, so framing them keeps the lit doorway in the slice too.
  'desert-coffee': 68,
  'desert-rock-pavilion': 60,
  // No person in frame; centred on the lit desk.
  'forest-console-invitation': 50,
  // The woman at the far table, who lands just above the copy. The man in the
  // near chair is larger but sits under it, back to the room.
  'forest-river-cafe': 50,
  // The exception to favouring a person: the one figure sits so hard against
  // the left edge that framing them means losing the waterfall the image is
  // built around. Centred on the view instead; in portrait they fall outside.
  'forest-waterfall-salon': 18,
  'garden-pool': 66,
  'library-in-jungle': 80,
  // The figure sits almost against the left edge, as in forest-waterfall-salon,
  // but here the slice can hold both: just wide enough to keep her and the water.
  // The pair at the window tables, with the maples and the pond still behind
  // them. Framed on the garden alone the room reads as empty.
  'maple-garden-cafe': 62,
  'meditating-ocean': 20,
  // The barista at the counter. The reader on the terrace sits low enough in
  // the frame that no horizontal framing lifts him clear of the headline, and
  // the sea only appears as a sliver beside him; it keeps the landscape view.
  'mediterranean-terrace-cafe': 30,
  'mist-lake-pavilion': 30,
  'mountain-cavern': 55,
  // Just wide enough to keep the figure at the desk on the left edge without
  // giving up the fjord — he still reads as a person at this size.
  'nordic-fjord-study': 12,
  // No person in frame; centred on the desk and chair.
  'ocean-workstation-invitation': 68,
  'oculus-courtyard': 68,
  // The woman at the long table, under the tall window and the olive hills —
  // the orangery and its view in one slice.
  'olive-orangery-library': 40,
  'open-ocean-reading-room': 16,
  'rain-garden-pavilion': 64,
  // The terraces the room is named for barely survive a portrait slice; this
  // keeps the woman at her desk instead, and the valley to the landscape view.
  'rice-terrace-focus-pavilion': 20,
  // The desk and its lamp. The arched window is the better photograph, but it
  // is the only frame here with anyone in it.
  'snow-valley-monastery-study': 40,
  'valley-vault': 34,
  // Off the desk a little, so the slice carries some of the lake it looks at.
  'work-lake-view': 26,
};

/**
 * Where to centre the crop vertically. Rarely worth setting.
 *
 * Unlike FOCAL_X this is not a phone concern: a 16:9 photograph in a portrait
 * window is scaled to fill the height exactly, so nothing is cropped off the
 * top or bottom there, and a 16:9-or-narrower desktop window is the same. Only
 * a viewport wider than 16:9 crops vertically — an ultrawide 2560x1080 loses
 * about a fifth of the height. Centred is right for almost every room; this is
 * for the ones where it drops something the room needs.
 */
export const FOCAL_Y = {};
