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

export function shouldProgress(planned: number | null, lastTwoTopSets: number[]): boolean {
  if (planned === null) return false;
  if (lastTwoTopSets.length < 2) return false;
  return lastTwoTopSets.slice(0, 2).every((reps) => reps >= planned + 2);
}
