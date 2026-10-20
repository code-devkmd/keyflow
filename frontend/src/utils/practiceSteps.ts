import type { NoteEvent } from "../types/music";
import { groupChords } from "./chordUtils";
import { midiToNoteName } from "./musicTheory";

/** One thing to play: a note or chord, positioned in beats from the start. */
export interface Step {
  notes: number[];
  label: string;
  at: number;
}

export function stepLabel(notes: number[]): string {
  return notes.map(midiToNoteName).join(" + ");
}

/** Converts song notes (seconds) to steps (beats). Simultaneous notes become one chord step. */
export function songToSteps(
  notes: readonly NoteEvent[],
  songBpm: number,
  octaveShift = 0,
  chordTolerance = 0.03,
): Step[] {
  const perSecond = songBpm / 60;
  const out: Step[] = [];
  for (const group of groupChords(notes, chordTolerance)) {
    const midis = [...new Set(group.map((n) => n.midi + octaveShift * 12))]
      .filter((m) => m >= 0 && m <= 127)
      .sort((a, b) => a - b);
    if (midis.length)
      out.push({
        notes: midis,
        label: stepLabel(midis),
        at: group[0].startTime * perSecond,
      });
  }
  return out;
}

/** Index of the step that is current at beat t: the last step that has started (0 before the first). */
export function currentStepIndex(steps: readonly Step[], t: number): number {
  let lo = 0,
    hi = steps.length - 1,
    ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (steps[mid].at <= t + 1e-9) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/**
 * Finds which step a pressed note counts for: the closest not-yet-hit step containing the note
 * within `window` beats of time t. Returns -1 for a wrong or badly-timed note.
 */
export function matchStep(
  steps: readonly Step[],
  t: number,
  midi: number,
  used: ReadonlySet<string>,
  window = 0.48,
): number {
  let best = -1,
    bestDist = Infinity;
  const from = currentStepIndex(steps, t - window);
  for (
    let i = Math.max(0, from - 1);
    i < steps.length && steps[i].at <= t + window;
    i++
  ) {
    const dist = Math.abs(steps[i].at - t);
    if (
      dist <= window &&
      dist < bestDist &&
      steps[i].notes.includes(midi) &&
      !used.has(`${i}:${midi}`)
    ) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}
