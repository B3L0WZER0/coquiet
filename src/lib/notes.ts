/** Focus notes and break suggestions. */

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
  'Start before you are sure.',
  'The opening line can be plain.',
  'Put one word down.',
  'Clear a small space and sit in it.',
  'The first ten minutes are the whole trick.',
  'You are not required to be inspired.',
  'Pick the task you can picture finishing.',
  'Name the next action, then take it.',
  'Set the bar low enough to step over.',
  'Arrive first. Decide afterwards.',

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
  'Stay a little past the first restlessness.',
  'The middle is meant to feel like this.',
  'Keep going without deciding to.',
  'One more paragraph. One more line.',
  'Hold the thread loosely.',
  'Work at the speed you can keep.',
  'Long attention is built in short pieces.',
  'Do not negotiate with yourself yet.',
  'The session is short. Spend it here.',
  'Stay until the timer says otherwise.',

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
  'Make the problem smaller until it moves.',
  'Describe the difficulty in one sentence.',
  'If you cannot solve it, describe it.',
  'The obstacle is usually a missing detail.',
  'Try the version that will obviously fail.',
  'Ask what you are actually stuck on.',
  'Hard work often looks like sitting still.',
  'Resistance often means it matters.',
  'Go around it and come back.',
  'Being lost is how you learn the terrain.',

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
  'Steady beats intense.',
  'A calm pace is still a pace.',
  'Do less, but do it today.',
  'You have this hour. That is plenty.',
  'Rushing rarely saves time.',
  'Slow attention is real attention.',
  'The clock is not your opponent.',
  'Twenty-five minutes is not nothing.',
  'No one is timing you but you.',
  'Take the long way if it is clearer.',

  // Letting it be unfinished
  'Let it be unfinished for now.',
  'Good enough to continue is good enough.',
  'A rough version is still a version.',
  'You can fix it once it exists.',
  'Finish it badly, then improve it.',
  'Perfection is a way of not finishing.',
  'Leave the polishing for later.',
  'Draft badly. Edit later.',
  'The first version is for you alone.',
  'Unfinished is a normal state for work.',
  'Nothing has to be right the first time.',
  'Leave the gaps and keep going.',
  'Mark the hole and move past it.',
  'It only has to exist by the end.',
  'Better later. Existing now.',

  // Coming back
  'Return to it without comment.',
  'Come back without scolding yourself.',
  'Wandering off is normal. Wander back.',
  'Notice, and return.',
  'You lost the thread. Pick it up again.',
  'Begin again as often as you need to.',
  'Where you left off is still there.',
  'The thread is where you dropped it.',
  'Two minutes away is not a lost hour.',
  'Come back at the sentence you stopped on.',
  'Reread the last line and continue.',
  'Drifting is not failing.',
  'Start again in the middle. That is allowed.',

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
  'One tab is enough.',
  'Give it your whole attention for a while.',
  'The phone can wait in another room.',
  'Nothing else needs you this hour.',
  'Attention is a thing you spend.',
  'Empty the desk before you fill the page.',
  'Silence the things that ask for you.',
  'Look at the work, not at the clock.',
  'Hold one question at a time.',
  'Set the other tasks aside, visibly.',

  // The body
  'Soften your shoulders.',
  'Unclench your jaw.',
  'Sit back. Look up. Continue.',
  'Breathe out, then the next line.',
  'Focus is not strain.',
  'Let your hands rest a moment.',
  'Uncurl your fingers.',
  'Sit as if you plan to stay.',
  'Loosen your grip.',
  'Blink. Look away. Look back.',
  'Straighten a little, without stiffening.',
  'Let your breathing slow on its own.',
  'Comfort first, then concentration.',

  // Mood
  'Trust the work more than the mood.',
  'Mood is weather. Keep going.',
  'The work does not require your anxiety.',
  'You can think and work at the same time.',
  'Doing beats planning to do.',
  'Be patient with the slow parts.',
  'Interest often arrives after starting.',
  'You do not have to want to.',
  'Feelings are not instructions.',
  'Work first; motivation follows.',
  'Boredom is often the doorway.',
  'Doubt can sit beside you and wait.',
  'The mood will change. The work stays.',
  'You can be unsure and still continue.',
  'Care about it a little less, and start.',

  // Progress
  'Small progress is still progress.',
  'It adds up while you are not watching.',
  'Today, only today’s piece.',
  'Progress you cannot see is still progress.',
  'The next right thing is usually small.',
  'A page a day becomes a book.',
  'Count what you did, not what is left.',
  'You are further along than this hour feels.',
  'Small things, done, become large ones.',
  'Yesterday you also thought it was too slow.',
  'The pile grows from underneath.',
  'What you finish today, you keep.',
  'Repetition is how anything gets built.',

  // Company
  //
  // The room is shared, so a few notes say so — quietly, and without ever
  // implying anyone is watching, which is the whole promise of the place.
  'Others are working too, quietly.',
  'You are not doing this alone.',
  'Somewhere else, someone is also starting.',
  'The room is quiet on purpose.',
  'Nobody here needs anything from you.',
  'Shared quiet is easier than solitary quiet.',
  'No one is watching your progress.',
  'The company here asks nothing of you.',

  // Stopping
  'You are allowed to stop.',
  'Stop before you are empty.',
  'Rest is part of the work.',
  'Tired is a reason, not an excuse.',
  'Stop somewhere you can start from.',
  'Leave a note for tomorrow’s you.',
  'It is enough to have been here.',
  'End at a natural place, not an empty one.',
  'Save something for tomorrow.',
  'Stop while you still know what comes next.',
  'Finishing the session is finishing.',
  'Close it gently.',
  'You did the hour. That was the task.',
  'Put it down properly.',
  'Leave the desk ready for next time.',
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
  'Open a window for a minute.',
  'Look at the furthest thing you can see.',
  'Stand up and stretch overhead.',
  'Roll your neck, slowly.',
  'Wash your hands with warm water.',
  'Sit back and do nothing at all.',
  'Rest your eyes behind your palms.',
  'Shake out your wrists.',
  'Tidy one small thing on your desk.',
  'Step away from the screen entirely.',
  'Stand in daylight, if there is any.',
  'Stretch your legs under the desk.',
  'Look up at the ceiling for a moment.',
  'Put your phone face down and leave it.',
  'Eat something small.',
  'Lean back and let your eyes unfocus.',
  'Walk a slow lap of the room.',
  'Rinse your face.',
  'Sit still and listen to the music.',
];

const HOUR_MS = 60 * 60 * 1000;

/** Which global hour we are in. */
export function globalHour(now: number = Date.now()): number {
  return Math.floor(now / HOUR_MS);
}

/** The note for the current hour. */
export function noteForHour(now: number = Date.now()): string {
  const index = ((globalHour(now) % FOCUS_NOTES.length) + FOCUS_NOTES.length) % FOCUS_NOTES.length;
  return FOCUS_NOTES[index];
}

/** A break suggestion. */
export function breakSuggestion(breakCount: number, now: number = Date.now()): string {
  const offset = globalHour(now) + breakCount;
  const index =
    ((offset % BREAK_SUGGESTIONS.length) + BREAK_SUGGESTIONS.length) % BREAK_SUGGESTIONS.length;
  return BREAK_SUGGESTIONS[index];
}
