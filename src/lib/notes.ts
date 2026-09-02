/**
 * Focus notes and break suggestions.
 *
 * Original lines, deliberately plain. No quotations, no attributions, nothing
 * borrowed from anyone — a misattributed quote is worse than no quote, and a
 * famous one would make the room sound like somebody else's.
 *
 * The voice is a note left on a desk rather than a motivational poster: quiet,
 * unhurried, occasionally permissive. Nothing exhorts, nothing congratulates,
 * nothing uses an exclamation mark. Several of them give permission to stop,
 * which a room for concentration should be able to do without irony.
 *
 * Both lists can be replaced wholesale; nothing else needs to change. Keep
 * notes under `MAX_NOTE_LENGTH` so they stay within two lines at the size the
 * room shows them.
 */

/** Longer than this and the note wraps to a third line in the room. */
export const MAX_NOTE_LENGTH = 58;

export const FOCUS_NOTES: readonly string[] = [
  // Beginning
  'One thing at a time.',
  'Begin gently. Continue steadily.',
  'Start where you actually are.',
  'Beginning counts as working.',
  'You do not need to feel ready.',
  'Open it. That is enough for now.',
  'A small start, without ceremony.',
  'The first attempt is allowed to be wrong.',
  'Do the boring part first.',
  'Choose the smaller version.',

  // Staying with it
  'Stay with the work.',
  'Keep your hands moving.',
  'Continue from where you left it.',
  'The next part, then the part after.',
  'Steady is quicker than it feels.',
  'Carry on quietly.',
  'A little, often.',
  'Quiet effort, repeated.',
  'Little by little, without noise.',
  'One decision at a time.',

  // When it is hard
  'The difficult part is usually the next part.',
  'Hard is not the same as wrong.',
  'Confusion is part of understanding.',
  'If it resists, look at it more closely.',
  'Difficulty is information, not a verdict.',
  'Stuck is a place, not a person.',
  'Sit with the hard part a little longer.',
  'The tangle comes apart one thread at a time.',
  'Not knowing yet is a normal place to be.',

  // Pace
  'Slow is fine. Stopping is fine too.',
  'You do not have to hurry.',
  'Unhurried still arrives.',
  'There is more time than it feels like.',
  'Let it take the time it takes.',
  'Nothing here is urgent.',
  'You are not behind.',
  'This hour is yours.',
  'Half an hour is a real amount of time.',

  // Letting it be unfinished
  'Let it be unfinished for now.',
  'Good enough to continue is good enough.',
  'A rough version is still a version.',
  'You can fix it once it exists.',
  'Finish it badly, then improve it.',
  'Perfection is a way of not finishing.',
  'Leave the polishing for later.',

  // Coming back
  'Return to it without comment.',
  'Come back without scolding yourself.',
  'Wandering off is normal. Wander back.',
  'Notice, and return.',
  'You lost the thread. Pick it up again.',
  'Begin again as often as you need to.',

  // Attention
  'Attention is the whole of it.',
  'Quiet hands, quiet mind.',
  'One window. One thought.',
  'Put the other things down.',
  'Look at one thing until it clears.',
  'What is loudest is rarely most important.',
  'Close what you are not using.',
  'Write it down so you can forget it.',
  'Let the notifications wait.',

  // The body
  'Soften your shoulders.',
  'Unclench your jaw.',
  'Sit back. Look up. Continue.',
  'Breathe out, then the next line.',
  'Focus is not strain.',

  // Mood
  'Trust the work more than the mood.',
  'Mood is weather. Keep going.',
  'The work does not require your anxiety.',
  'You can think and work at the same time.',
  'Doing beats planning to do.',
  'Be patient with the slow parts.',
  'Interest often arrives after starting.',

  // Progress
  'Small progress is still progress.',
  'It adds up while you are not watching.',
  'Today, only today’s piece.',
  'Progress you cannot see is still progress.',
  'The next right thing is usually small.',

  // Stopping
  'You are allowed to stop.',
  'Stop before you are empty.',
  'Rest is part of the work.',
  'Tired is a reason, not an excuse.',
  'Stop somewhere you can start from.',
  'Leave a note for tomorrow’s you.',
  'It is enough to have been here.',
];

export const BREAK_SUGGESTIONS: readonly string[] = [
  'Look at something far away.',
  'Stretch your hands and shoulders.',
  'Make a tea.',
  'Stand up and walk to a window.',
  'Drink some water.',
  'Let your eyes close for a moment.',
  'Roll your shoulders back, slowly.',
  'Step outside, if you can.',
  'Put your feet flat on the floor.',
  'Look out of the window and think of nothing.',
  'Refill your glass.',
  'Stretch your back, gently.',
  'Walk to another room and back.',
  'Rest your eyes on something green.',
  'Let your arms hang loose.',
  'Take a slower breath than usual.',
];

const HOUR_MS = 60 * 60 * 1000;

/** Which global hour we are in. The same integer everywhere on earth. */
export function globalHour(now: number = Date.now()): number {
  return Math.floor(now / HOUR_MS);
}

/**
 * The note for the current hour.
 *
 * Chosen from the hour number alone, so every visitor sees the same note during
 * the same hour without any coordination — and it changes on the hour boundary
 * without a reload. With this many notes the collection takes several days to
 * come round again, so nobody meets the same line twice in a sitting.
 */
export function noteForHour(now: number = Date.now()): string {
  const index = ((globalHour(now) % FOCUS_NOTES.length) + FOCUS_NOTES.length) % FOCUS_NOTES.length;
  return FOCUS_NOTES[index];
}

/**
 * A break suggestion. Rotates with each break rather than being random, so a
 * visitor taking several breaks does not see the same line twice in a row.
 */
export function breakSuggestion(breakCount: number, now: number = Date.now()): string {
  const offset = globalHour(now) + breakCount;
  const index =
    ((offset % BREAK_SUGGESTIONS.length) + BREAK_SUGGESTIONS.length) % BREAK_SUGGESTIONS.length;
  return BREAK_SUGGESTIONS[index];
}
