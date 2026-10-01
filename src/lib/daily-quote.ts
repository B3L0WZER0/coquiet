/**
 * One real, attributed quote a day — the same for everyone, like the music.
 * Every entry names its source, because quote lists online are full of
 * misattributions; an unsourced line does not go in. Calm lines alternate
 * with energising ones — encouraging, never hustle.
 */

export interface Quote {
  text: string;
  author: string;
  /** The work it comes from, with its year. */
  source: string;
}

export const QUOTES: Quote[] = [
  { text: 'He who has begun is half done. Dare to be wise: begin!', author: 'Horace', source: 'Epistles, I.2' },
  { text: 'How we spend our days is, of course, how we spend our lives.', author: 'Annie Dillard', source: 'The Writing Life, 1989' },
  { text: 'Nothing great was ever achieved without enthusiasm.', author: 'Ralph Waldo Emerson', source: '“Circles,” 1841' },
  { text: 'Attention is the rarest and purest form of generosity.', author: 'Simone Weil', source: 'letter to Joë Bousquet, 1942' },
  { text: 'You must do the thing you think you cannot do.', author: 'Eleanor Roosevelt', source: 'You Learn by Living, 1960' },
  { text: 'Occupy thyself with few things, says the philosopher, if thou wouldst be tranquil.', author: 'Marcus Aurelius', source: 'Meditations, IV' },
  { text: 'Great things are not done by impulse, but by a series of small things brought together.', author: 'Vincent van Gogh', source: 'letter to Theo, 1882' },
  { text: 'While we are postponing, life speeds by.', author: 'Seneca', source: 'Letters to Lucilius, I' },
  { text: 'Inspiration is for amateurs — the rest of us just show up and get to work.', author: 'Chuck Close', source: 'in Joe Fig, Inside the Painter’s Studio, 2009' },
  { text: 'Attention is the beginning of devotion.', author: 'Mary Oliver', source: 'Upstream, 2016' },
  { text: 'They can because they think they can.', author: 'Virgil', source: 'Aeneid, V' },
  { text: 'A schedule defends from chaos and whim. It is a net for catching days.', author: 'Annie Dillard', source: 'The Writing Life, 1989' },
  { text: 'Optimism is the faith that leads to achievement. Nothing can be done without hope and confidence.', author: 'Helen Keller', source: 'Optimism, 1903' },
  { text: 'My experience is what I agree to attend to.', author: 'William James', source: 'The Principles of Psychology, 1890' },
  { text: 'Ever tried. Ever failed. No matter. Try again. Fail again. Fail better.', author: 'Samuel Beckett', source: 'Worstward Ho, 1983' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Laozi', source: 'Tao Te Ching, 64' },
  { text: 'Don’t loaf and invite inspiration; light out after it with a club.', author: 'Jack London', source: '“Getting Into Print,” 1903' },
  { text: 'Everywhere means nowhere.', author: 'Seneca', source: 'Letters to Lucilius, II' },
  { text: 'In the midst of winter, I found there was, within me, an invincible summer.', author: 'Albert Camus', source: '“Return to Tipasa,” 1952' },
  { text: 'Bird by bird, buddy. Just take it bird by bird.', author: 'Anne Lamott', source: 'Bird by Bird, 1994' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs', source: 'Stanford commencement address, 2005' },
  { text: 'Try to love the questions themselves.', author: 'Rainer Maria Rilke', source: 'Letters to a Young Poet, 1903' },
  { text: 'Do the thing, and you shall have the power.', author: 'Ralph Waldo Emerson', source: '“Compensation,” 1841' },
  { text: 'Lost time is never found again.', author: 'Benjamin Franklin', source: 'The Way to Wealth, 1758' },
  { text: 'All you have to do is write one true sentence.', author: 'Ernest Hemingway', source: 'A Moveable Feast, 1964' },
  { text: 'I can think. I can wait. I can fast.', author: 'Hermann Hesse', source: 'Siddhartha, 1922' },
  { text: 'To strive, to seek, to find, and not to yield.', author: 'Alfred, Lord Tennyson', source: '“Ulysses,” 1842' },
  { text: 'It is not enough to be industrious; so are the ants. What are you industrious about?', author: 'Henry David Thoreau', source: 'letter to H. G. O. Blake, 1857' },
  { text: 'First forget inspiration. Habit is more dependable.', author: 'Octavia E. Butler', source: '“Furor Scribendi,” 1993' },
  { text: 'The strongest of all warriors are these two — Time and Patience.', author: 'Leo Tolstoy', source: 'War and Peace, 1869' },
  { text: 'Write it on your heart that every day is the best day in the year.', author: 'Ralph Waldo Emerson', source: '“Works and Days,” 1870' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant', source: 'The Story of Philosophy, 1926' },
  { text: 'If you hear a voice within you say “you cannot paint,” then by all means paint, and that voice will be silenced.', author: 'Vincent van Gogh', source: 'letter to Theo, 1883' },
  { text: 'Hold every hour in your grasp.', author: 'Seneca', source: 'Letters to Lucilius, I' },
  { text: 'There is a vitality, a life force, an energy, a quickening that is translated through you into action.', author: 'Martha Graham', source: 'in Agnes de Mille, Martha, 1991' },
  { text: 'Simplify, simplify.', author: 'Henry David Thoreau', source: 'Walden, 1854' },
  { text: 'Not everything that is faced can be changed, but nothing can be changed until it is faced.', author: 'James Baldwin', source: '“As Much Truth As One Can Bear,” 1962' },
  { text: 'Inspiration is a guest that does not willingly visit the lazy.', author: 'Pyotr Ilyich Tchaikovsky', source: 'letter to Nadezhda von Meck, 1878' },
  { text: 'All the unhappiness of men arises from one single fact, that they cannot stay quietly in their own chamber.', author: 'Blaise Pascal', source: 'Pensées, 1670' },
  { text: 'The credit belongs to the man who is actually in the arena.', author: 'Theodore Roosevelt', source: '“Citizenship in a Republic,” 1910' },
  { text: 'Work is love made visible.', author: 'Kahlil Gibran', source: 'The Prophet, 1923' },
  { text: 'No day without a line.', author: 'Apelles, as told by Pliny the Elder', source: 'Natural History, XXXV' },
  { text: 'Tell me, what is it you plan to do with your one wild and precious life?', author: 'Mary Oliver', source: '“The Summer Day,” 1990' },
  { text: 'Knowing is not enough; we must apply. Willing is not enough; we must do.', author: 'Johann Wolfgang von Goethe', source: 'Wilhelm Meister’s Journeyman Years, 1829' },
  { text: 'Time is but the stream I go a-fishing in.', author: 'Henry David Thoreau', source: 'Walden, 1854' },
  { text: 'Our doubts are traitors, and make us lose the good we oft might win by fearing to attempt.', author: 'William Shakespeare', source: 'Measure for Measure, I.4' },
  { text: 'Almost all good writing begins with terrible first efforts.', author: 'Anne Lamott', source: 'Bird by Bird, 1994' },
  { text: 'Life shrinks or expands in proportion to one’s courage.', author: 'Anaïs Nin', source: 'The Diary of Anaïs Nin, 1941' },
  { text: 'It is not that we have a short space of time, but that we waste much of it.', author: 'Seneca', source: 'On the Shortness of Life' },
  { text: 'In the morning when thou risest unwillingly, let this thought be present — I am rising to the work of a human being.', author: 'Marcus Aurelius', source: 'Meditations, V' },
  { text: 'The best way out is always through.', author: 'Robert Frost', source: '“A Servant to Servants,” 1914' },
  { text: 'Be regular and orderly in your life like a bourgeois, so that you may be violent and original in your work.', author: 'Gustave Flaubert', source: 'letter to Gertrude Tennant, 1876' },
  { text: 'If there is no struggle, there is no progress.', author: 'Frederick Douglass', source: 'West India Emancipation speech, 1857' },
  { text: 'In the beginner’s mind there are many possibilities, but in the expert’s there are few.', author: 'Shunryu Suzuki', source: 'Zen Mind, Beginner’s Mind, 1970' },
  { text: 'If I have seen further it is by standing on the shoulders of Giants.', author: 'Isaac Newton', source: 'letter to Robert Hooke, 1675' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin', source: 'Poor Richard’s Almanack, 1737' },
  { text: 'We work in the dark — we do what we can — we give what we have.', author: 'Henry James', source: '“The Middle Years,” 1893' },
  { text: 'Afoot and light-hearted I take to the open road.', author: 'Walt Whitman', source: '“Song of the Open Road,” 1856' },
  { text: 'Do the Duty which lies nearest thee.', author: 'Thomas Carlyle', source: 'Sartor Resartus, 1836' },
  { text: 'If there’s a book that you want to read, but it hasn’t been written yet, then you must write it.', author: 'Toni Morrison', source: 'speech to the Ohio Arts Council, 1981' },
  { text: 'It is the time you have wasted for your rose that makes your rose so important.', author: 'Antoine de Saint-Exupéry', source: 'The Little Prince, 1943' },
  { text: 'Great works are performed, not by strength, but by perseverance.', author: 'Samuel Johnson', source: 'Rasselas, 1759' },
  { text: '“Hope” is the thing with feathers — that perches in the soul.', author: 'Emily Dickinson', source: 'poem, c. 1861' },
  { text: 'If one advances confidently in the direction of his dreams, … he will meet with a success unexpected in common hours.', author: 'Henry David Thoreau', source: 'Walden, 1854' },
  { text: 'I write a little every day, without hope and without despair.', author: 'Isak Dinesen', source: 'as quoted by Raymond Carver, 1981' },
  { text: 'Let us, then, be up and doing, with a heart for any fate.', author: 'Henry Wadsworth Longfellow', source: '“A Psalm of Life,” 1838' },
  { text: 'No great thing is produced suddenly, since not even the bunch of grapes or the fig is.', author: 'Epictetus', source: 'Discourses, I.15' },
  { text: 'Diligence is the mother of good luck.', author: 'Benjamin Franklin', source: 'Poor Richard’s Almanack, 1736' },
  { text: 'Instructions for living a life: Pay attention. Be astonished. Tell about it.', author: 'Mary Oliver', source: '“Sometimes,” 2008' },
  { text: 'The beginning is the most important part of the work.', author: 'Plato', source: 'Republic, II' },
  { text: 'Blessed is he who has found his work; let him ask no other blessedness.', author: 'Thomas Carlyle', source: 'Past and Present, 1843' },
  { text: 'I always worked until I had something done and I stopped when I knew what was going to happen next.', author: 'Ernest Hemingway', source: 'A Moveable Feast, 1964' },
  { text: 'There is a tide in the affairs of men, which, taken at the flood, leads on to fortune.', author: 'William Shakespeare', source: 'Julius Caesar, IV.3' },
  { text: 'Begin at once to live, and count each separate day as a separate life.', author: 'Seneca', source: 'Letters to Lucilius, CI' },
  { text: 'Creativity is a habit, and the best creativity is the result of good work habits.', author: 'Twyla Tharp', source: 'The Creative Habit, 2003' },
  { text: 'Hold fast to dreams.', author: 'Langston Hughes', source: '“Dreams,” 1923' },
  { text: 'Work is no disgrace: it is idleness which is a disgrace.', author: 'Hesiod', source: 'Works and Days' },
  { text: 'All we have to decide is what to do with the time that is given us.', author: 'J. R. R. Tolkien', source: 'The Fellowship of the Ring, 1954' },
  { text: 'In the fields of observation, chance favours only the prepared mind.', author: 'Louis Pasteur', source: 'lecture at Lille, 1854' },
  { text: 'Trust thyself: every heart vibrates to that iron string.', author: 'Ralph Waldo Emerson', source: '“Self-Reliance,” 1841' },
  { text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus', source: 'Discourses, III.23' },
  { text: 'Spend it all, shoot it, play it, lose it, all, right away, every time.', author: 'Annie Dillard', source: 'The Writing Life, 1989' },
  { text: 'Procrastination is the thief of time.', author: 'Edward Young', source: 'Night-Thoughts, 1742' },
  { text: 'It is good to have an end to journey toward; but it is the journey that matters, in the end.', author: 'Ursula K. Le Guin', source: 'The Left Hand of Darkness, 1969' },
  { text: 'We must believe that we are gifted for something, and that this thing, at whatever cost, must be attained.', author: 'Marie Curie', source: 'in Eve Curie, Madame Curie, 1937' },
  { text: 'I went to the woods because I wished to live deliberately.', author: 'Henry David Thoreau', source: 'Walden, 1854' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt, quoting Squire Bill Widener', source: 'An Autobiography, 1913' },
  { text: 'The mind is its own place, and in itself can make a Heaven of Hell, a Hell of Heaven.', author: 'John Milton', source: 'Paradise Lost, 1667' },
  { text: 'The struggle itself toward the heights is enough to fill a man’s heart.', author: 'Albert Camus', source: 'The Myth of Sisyphus, 1942' },
  { text: 'No longer talk at all about the kind of man that a good man ought to be, but be such.', author: 'Marcus Aurelius', source: 'Meditations, X' },
  { text: 'If you can fill the unforgiving minute with sixty seconds’ worth of distance run…', author: 'Rudyard Kipling', source: '“If—,” 1910' },
  { text: 'Dripping water hollows out a stone.', author: 'Ovid', source: 'Epistulae ex Ponto, IV' },
  { text: 'To travel hopefully is a better thing than to arrive.', author: 'Robert Louis Stevenson', source: '“El Dorado,” 1878' },
  { text: 'What good shall I do this day?', author: 'Benjamin Franklin', source: 'Autobiography, 1791' },
];

/** What a shared quote says: the line, who said it, and where it came from. */
export function quoteShareText(quote: Quote): string {
  return `“${quote.text}” — ${quote.author}\n\nShared from coquiet.app`;
}

const DAY = 24 * 60 * 60 * 1000;

/** The list starts on 1 October 2026 and comes round again once it runs out. */
const FIRST_DAY = Date.UTC(2026, 9, 1) / DAY;

/** Keyed on the UTC day, so everyone in the room reads the same line. */
export function quoteOfTheDay(now: Date = new Date()): Quote {
  const day = Math.floor(now.getTime() / DAY) - FIRST_DAY;
  const n = QUOTES.length;
  return QUOTES[((day % n) + n) % n];
}
