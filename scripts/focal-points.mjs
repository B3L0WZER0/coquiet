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
  // The peaks over the larch valley and an empty desk. Framed on the man, a
  // stone pillar filled the slice and put him behind the headline.
  'alpine-peak-library': 40,
  // The painter at her easel, with the orchard window beside her. She sits
  // almost against the left edge, so the slice starts further left than the
  // sheet's tiles suggest to keep her off it.
  'applelight-atelier': 5,
  // The reader under the great arch, with the mountains behind him.
  'arched-tree-cafe': 55,
  'architecture-canyon': 73,
  'architecture-fireplace-lake': 65,
  // The woman at the table by the glass, with the cliffs falling to the sea.
  'atlantic-fold-library': 40,
  // The woman at the tall window, with the cloister and its copper trees.
  'autumn-courtyard-cafe': 50,
  // The waterfall over the rocks. The one figure sits against the far-left
  // edge, a speck in the copy's band, so the view carries it instead.
  'autumn-ravine-studio': 52,
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
  // The craftsperson at the bench, with the tool wall and the bamboo light.
  'cedar-craft-atelier': 45,
  'circular-window-studio': 65,
  // The potter at his table by the glass and the mossy rocks. He sits under
  // the headline in every tile that has him (20 cut him at the edge); the only
  // other choice is an empty bench, so this keeps him.
  'clay-and-quiet': 15,
  'cliff-cave': 50,
  'cliffside-cafe-focus': 68,
  // The reader at his table, with the headland and the surf behind him.
  'cliffside-coffee-house': 45,
  // The man at the desk against the window onto the cloud in the valley.
  'cloudline-walnut-study': 60,
  'coastal-grotto-writer': 60,
  'coastal-observatory': 74,
  'coffee-lake-mountain-view': 45,
  'coffee-lake-view': 61,
  'concrete-cave': 63,
  // The woman at the desk against the glass, with the shelves beside her.
  'copper-beech-library': 85,
  // The two readers under the run of arches.
  'courtyard-arch-cafe': 58,
  'desert-arches': 42,
  // The reader at the shelves between the rock face and the desert view.
  'desert-cleft-library': 30,
  // Two other figures are further out; the reader in the chair sits next to the
  // courtyard tree, so framing them keeps the lit doorway in the slice too.
  'desert-coffee': 68,
  'desert-rock-pavilion': 60,
  // No person in frame; centred on the lit desk.
  // The woman at her laptop against the rain window, with the fern court.
  'fern-court-cafe': 15,
  // The waterfall down the fjord wall, with the man at his table below it.
  'fjord-vault-cafe': 65,
  'forest-console-invitation': 50,
  // The woman at the far table, who lands just above the copy. The man in the
  // near chair is larger but sits under it, back to the room.
  'forest-river-cafe': 50,
  // The exception to favouring a person: the one figure sits so hard against
  // the left edge that framing them means losing the waterfall the image is
  // built around. Centred on the view instead; in portrait they fall outside.
  'forest-waterfall-salon': 18,
  'garden-pool': 66,
  // The ginkgo over the water court. The two working here are small and far
  // back; the tree is what the room is built around.
  'ginkgo-courtyard-studio': 20,
  // The woodworker at his bench, with the river through the long window.
  'grain-and-patience': 80,
  // The reader by the fire, doubled in the pool below.
  // The man at the desk by the shelves, with the pool and the autumn trees.
  'granite-garden-study': 74,
  'granite-pool-reading-room': 45,
  // The woman at the desk by the glass, with the misted hills behind her.
  // Short of 90, where she sat squarely under the headline's second line.
  'harvest-lantern': 84,
  // The man at the lamp-lit desk in the window, with the sea beyond it.
  'heather-cottage-study': 80,
  // The man at the desk by the shelves, with the mist off the lake behind.
  'lake-shoji-library': 25,
  // The woman at the window desk, with the lake filling the rest.
  'lake-window-library': 82,
  'library-in-jungle': 80,
  // The figure sits almost against the left edge, as in forest-waterfall-salon,
  // but here the slice can hold both: just wide enough to keep her and the water.
  // The pair at the window tables, with the maples and the pond still behind
  // them. Framed on the garden alone the room reads as empty.
  'maple-garden-cafe': 62,
  // The woman reading in her chair, with the maples turning behind her.
  'maple-reading-pavilion': 30,
  'meditating-ocean': 20,
  // The barista at the counter. The reader on the terrace sits low enough in
  // the frame that no horizontal framing lifts him clear of the headline, and
  // the sea only appears as a sliver beside him; it keeps the landscape view.
  'mediterranean-terrace-cafe': 30,
  'mist-lake-pavilion': 30,
  // The man at the window table, with the lake and the far shore behind him.
  'misty-lake-cafe': 60,
  // The woman at the lamp-lit desk at the back, rather than the misty lake.
  'misty-lake-work-alcove': 85,
  // The pine over the moss court. The one figure sits at the far right edge,
  // small and in the copy's band; the garden is the room.
  'moss-court-study': 15,
  // The reader at the table under the mountain window.
  'mountain-boulder-library': 65,
  'mountain-cavern': 55,
  // The man at the window table and the ranges, rather than the library balcony.
  'mountain-library-cafe': 85,
  // Just wide enough to keep the figure at the desk on the left edge without
  // giving up the fjord — he still reads as a person at this size.
  'nordic-fjord-study': 12,
  // No person in frame; centred on the desk and chair.
  'ocean-workstation-invitation': 68,
  'oculus-courtyard': 68,
  // The woman at the long table, under the tall window and the olive hills —
  // the orangery and its view in one slice.
  'olive-orangery-library': 40,
  // The woman at her table under the arch, with the olive tree in the court.
  'olive-vault-cafe': 25,
  'open-ocean-reading-room': 16,
  // The binder at the lamp-lit bench under the vault.
  'orchard-hands': 55,
  // The reader in the low chair, with the old apple tree through the glass.
  'orchard-window-library': 70,
  // The papermaker at her table, with the arched window and the sea.
  'paper-in-the-light': 50,
  // The woman writing at the round table under the arch.
  'pearwood-morning': 80,
  // The reader at the long table under the lamp. The quince tree the room is
  // named for is half a photograph away, so it is left to the landscape view.
  'quince-court': 25,
  'rain-garden-pavilion': 64,
  // The figure at the far end of the window desks, down the lit row.
  'rain-on-the-cottage': 15,
  // The man at the desk, with the rain coming down the wooded ridge.
  'rainfall-ridge-studio': 55,
  // The window wall and its maples, with the two at the tables below them.
  'rainlit-maple-cafe': 55,
  // The woman at her table, with the wet bamboo through the glass beside her.
  'rainy-bamboo-cafe': 45,
  // The woman at the lit desk, with the redwood trunks through the glass.
  'redwood-lantern-library': 75,
  // The potter at her lit bench, with the edge of the marsh window.
  'reed-and-clay': 60,
  // The man at the long window desk, with the reedbeds and the water.
  'reedwater-observatory': 85,
  // The terraces the room is named for barely survive a portrait slice; this
  // keeps the woman at her desk instead, and the valley to the landscape view.
  'rice-terrace-focus-pavilion': 20,
  // The man at his desk against the glass, with the marsh channels beyond.
  'saltgrass-scriptorium': 85,
  // The sea arch at sunset, over the curved shelves. Both readers sit hard
  // against the edges, so this takes what the room is built to look at.
  'sea-arch-reading-room': 30,
  // The desk and its lamp. The arched window is the better photograph, but it
  // is the only frame here with anyone in it.
  'snow-valley-monastery-study': 40,
  // The woman at the table, with the quarry wall and the autumn tree.
  'stone-courtyard-cafe': 35,
  // The painter at the lit drawing board, with the autumn trees behind her.
  // Her head meets the headline at every framing; the lit board carries it.
  'the-first-wash': 80,
  // The painter at her easel, with the misty forest through the glass.
  'the-woodland-easel': 50,
  // The reader in the armchair by the orchard window.
  'the-cider-loft': 78,
  // The potter at her bench beside the old press. She sits at the far left
  // edge of the photograph, so the orchard window is left to the landscape view.
  'the-apple-press-studio': 10,
  // The woman at her drafting table, in the curve of the estuary window.
  'the-estuary-sketchroom': 75,
  // The illustrator at his board by the orchard window.
  'the-grafting-room': 10,
  // The reader in the chair by the shelves, clear of the headline's second
  // line. He sits at the far left edge of the photograph, so the tide channels
  // are left to the landscape view.
  'the-quiet-tide': 2,
  // The painter at her easel, at the end of the long marsh window.
  'the-reedbank-painter': 90,
  // The woman at the table by the glass, with the cliffs and the sea.
  'tidal-oculus-cafe': 85,
  // The woman at the table, with the dune grass and the sea through the doors.
  'tideline-cafe': 32,
  // The woman at the window table, with the rocks and the surf behind her.
  'tidepool-stone-cafe': 80,
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
