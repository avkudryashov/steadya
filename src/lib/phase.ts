import { daysBetween } from '@/lib/date';
import type { PhaseId, Program } from '@/content/schemas';

export interface ProgramMeta {
  id: string;
  weeks: number;
  phases: Program['phases'];
  deloadWeeks: number[];
}

export function weekFromStart(startIso: string, dateIso: string): number {
  const days = daysBetween(startIso, dateIso);
  if (days < 0) return 1;
  return Math.floor(days / 7) + 1;
}

export function phaseForWeek(meta: ProgramMeta, week: number): PhaseId {
  const hit = meta.phases.find((p) => week >= p.weeks[0] && week <= p.weeks[1]);
  if (hit) return hit.id;
  const last = meta.phases[meta.phases.length - 1];
  if (!last) throw new Error(`program ${meta.id} has no phases`);
  return week < meta.phases[0]!.weeks[0] ? meta.phases[0]!.id : last.id;
}

export function isDeloadWeek(meta: ProgramMeta, week: number): boolean {
  return meta.deloadWeeks.includes(week);
}

export interface PhaseState {
  week: number;
  phase: PhaseId;
  deload: boolean;
  beyondProgram: boolean;
}

export function resolvePhase(
  meta: ProgramMeta,
  opts: { startDate: string; phaseOverride: PhaseId | 'auto'; dateIso: string },
): PhaseState {
  const week = weekFromStart(opts.startDate, opts.dateIso);
  const auto = phaseForWeek(meta, week);
  return {
    week,
    phase: opts.phaseOverride === 'auto' ? auto : opts.phaseOverride,
    deload: isDeloadWeek(meta, week),
    beyondProgram: week > meta.weeks,
  };
}
