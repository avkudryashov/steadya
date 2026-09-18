const NUMBER = /\d+/g;

export function plannedTopReps(reps: string | undefined): number | null {
  if (!reps) return null;
  const found = reps.match(NUMBER);
  if (!found || found.length === 0) return null;
  const first = Number(found[0]);
  const isRange = /^\s*\d+\s*[–-]\s*\d+/.test(reps);
  if (isRange && found[1] !== undefined) return Number(found[1]);
  return first;
}

/**
 * Checks if progression is warranted by the "2 by 2" rule.
 * @param planned - The target repetitions, or null if no plan is set
 * @param lastTwoTopSets - The most recent set repetition values, ordered newest first (as returned by topSetsFor).
 * Only the first two values are considered; older sessions are ignored.
 * @returns true if both of the two most recent sets are at least `planned + 2`, false otherwise
 */
export function shouldProgress(planned: number | null, lastTwoTopSets: number[]): boolean {
  if (planned === null) return false;
  if (lastTwoTopSets.length < 2) return false;
  return lastTwoTopSets.slice(0, 2).every((reps) => reps >= planned + 2);
}
