import type { NoteEvent } from "@/shared/types/music";

/** Stable sort by start time, then pitch, then track. Does not mutate the input. */
export function sortNotes(notes: readonly NoteEvent[]): NoteEvent[] {
  return [...notes].sort(
    (a, b) => a.startTime - b.startTime || a.midi - b.midi || a.track - b.track,
  );
}

/**
 * Groups notes whose start times are within `tolerance` seconds of the group's first note.
 * Each group is a chord (or a single note) the player must play together, ordered by pitch.
 */
export function groupChords(
  notes: readonly NoteEvent[],
  tolerance = 0.03,
): NoteEvent[][] {
  const groups: NoteEvent[][] = [];
  for (const note of sortNotes(notes)) {
    const last = groups[groups.length - 1];
    if (last && note.startTime - last[0].startTime <= tolerance)
      last.push(note);
    else groups.push([note]);
  }
  return groups.map((g) =>
    g.sort((a, b) => a.midi - b.midi || a.track - b.track),
  );
}
