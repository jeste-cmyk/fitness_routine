import type { RepSetGroup, RoutineExercise } from './types';

const DEFAULT_SET_GROUP: RepSetGroup = { reps: 1, sets: 1 };

export function sanitizeSetGroup(group: RepSetGroup): RepSetGroup {
  return {
    reps: Math.max(1, Math.trunc(group.reps)),
    sets: Math.max(1, Math.trunc(group.sets)),
  };
}

export function normalizeSetGroups(value: unknown, fallback: RepSetGroup = DEFAULT_SET_GROUP): RepSetGroup[] {
  if (!Array.isArray(value)) {
    return [sanitizeSetGroup(fallback)];
  }

  const groups = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const maybeGroup = item as Partial<RepSetGroup>;
      const reps = Number(maybeGroup.reps);
      const sets = Number(maybeGroup.sets);

      if (!Number.isFinite(reps) || !Number.isFinite(sets)) {
        return null;
      }

      return sanitizeSetGroup({ reps, sets });
    })
    .filter((group): group is RepSetGroup => group !== null);

  return groups.length > 0 ? groups : [sanitizeSetGroup(fallback)];
}

export function getExerciseSetGroups(exercise: Pick<RoutineExercise, 'reps' | 'sets' | 'set_groups'>): RepSetGroup[] {
  return normalizeSetGroups(exercise.set_groups, { reps: exercise.reps, sets: exercise.sets });
}

export function getFirstSetGroup(groups: RepSetGroup[]): RepSetGroup {
  return groups[0] ?? DEFAULT_SET_GROUP;
}

export function getTotalSets(groups: RepSetGroup[]): number {
  return groups.reduce((total, group) => total + sanitizeSetGroup(group).sets, 0);
}

export function formatSetGroups(groups: RepSetGroup[]): string {
  return groups
    .map((group) => {
      const cleanGroup = sanitizeSetGroup(group);
      const setLabel = cleanGroup.sets === 1 ? 'set' : 'sets';
      const repLabel = cleanGroup.reps === 1 ? 'rep' : 'reps';
      return `${cleanGroup.sets} ${setLabel} x ${cleanGroup.reps} ${repLabel}`;
    })
    .join(', ');
}
