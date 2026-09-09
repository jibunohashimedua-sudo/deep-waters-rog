/**
 * The four depths.
 *
 * These replaced six badges, two of which counted streaks — a number this
 * app stopped printing anywhere — and all six of which needed an icon to
 * read as badges at all. The app has five icons and none of them is a
 * rosette.
 *
 * Named for the real ocean zones, which is where the app's own name comes
 * from, and reached by days kept rather than by days elapsed: this is a
 * record of reading, not of time passing.
 *
 * Nothing here says how far away the next one is. A depth you have not
 * reached is simply quieter than one you have.
 */
export type Depth = { at: number; name: string };

export const DEPTHS: Depth[] = [
  { at: 10, name: "Sunlight" },
  { at: 30, name: "Twilight" },
  { at: 60, name: "Midnight" },
  { at: 90, name: "The Deep" }
];
