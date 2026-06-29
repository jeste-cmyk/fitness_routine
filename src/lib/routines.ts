import { supabase } from './supabase';
import { getFirstSetGroup, getTotalSets, normalizeSetGroups } from './exercisePlan';
import {
  EditableExercise,
  ExerciseProgressEntry,
  ExerciseProgressSummary,
  ExerciseProgressTrend,
  Routine,
  RoutineExercise,
  RoutineSchedule,
  RoutineWithDetails,
  Weekday,
  WorkoutExerciseLog,
  WorkoutExerciseLogInput,
  WorkoutHistorySession,
  WorkoutSession,
} from './types';

function raise(error: unknown): never {
  if (error instanceof Error) {
    throw error;
  }

  // Supabase returns a plain PostgrestError object ({ message, details, hint,
  // code }), not an Error instance, so surface its message instead of a
  // generic fallback that hides what actually went wrong.
  if (error && typeof error === 'object' && 'message' in error) {
    const { message, details, hint, code } = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [message, details, hint].filter(
      (part): part is string => typeof part === 'string' && part.length > 0,
    );
    const text = parts.join(' — ') || 'Unexpected data error';
    throw new Error(typeof code === 'string' && code ? `${text} (${code})` : text);
  }

  throw new Error('Unexpected data error');
}

function sortExercises(exercises: RoutineExercise[]) {
  return [...exercises].sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeRoutineExercise(exercise: RoutineExercise): RoutineExercise {
  return {
    ...exercise,
    set_groups: normalizeSetGroups(exercise.set_groups, { reps: exercise.reps, sets: exercise.sets }),
  };
}

function normalizeWorkoutLog(log: WorkoutExerciseLog): WorkoutExerciseLog {
  return {
    ...log,
    planned_set_groups: normalizeSetGroups(log.planned_set_groups, {
      reps: log.planned_reps,
      sets: log.planned_sets,
    }),
    actual_set_groups: normalizeSetGroups(log.actual_set_groups, {
      reps: log.actual_reps,
      sets: log.actual_sets,
    }),
  };
}

function composeRoutineDetails(
  routines: Routine[],
  exercises: RoutineExercise[],
  schedules: RoutineSchedule[],
): RoutineWithDetails[] {
  return routines.map((routine) => ({
    ...routine,
    exercises: sortExercises(exercises.filter((exercise) => exercise.routine_id === routine.id).map(normalizeRoutineExercise)),
    schedule: schedules
      .filter((schedule) => schedule.routine_id === routine.id)
      .sort((a, b) => a.weekday - b.weekday),
  }));
}

export async function fetchRoutineDetails(userId: string): Promise<RoutineWithDetails[]> {
  const { data: routines, error: routinesError } = await supabase
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (routinesError) {
    raise(routinesError);
  }

  const typedRoutines = (routines ?? []) as Routine[];
  const routineIds = typedRoutines.map((routine) => routine.id);

  if (routineIds.length === 0) {
    return [];
  }

  const [{ data: exercises, error: exercisesError }, { data: schedules, error: schedulesError }] =
    await Promise.all([
      supabase.from('routine_exercises').select('*').in('routine_id', routineIds),
      supabase.from('routine_schedule').select('*').in('routine_id', routineIds),
    ]);

  if (exercisesError) {
    raise(exercisesError);
  }

  if (schedulesError) {
    raise(schedulesError);
  }

  return composeRoutineDetails(
    typedRoutines,
    (exercises ?? []) as RoutineExercise[],
    (schedules ?? []) as RoutineSchedule[],
  );
}

export async function fetchRoutineById(userId: string, routineId: string): Promise<RoutineWithDetails> {
  const routines = await fetchRoutineDetails(userId);
  const routine = routines.find((item) => item.id === routineId);

  if (!routine) {
    throw new Error('Routine not found');
  }

  return routine;
}

export async function saveRoutineDetails(params: {
  routineId?: string;
  userId: string;
  name: string;
  notes: string;
  weekdays: Weekday[];
  exercises: EditableExercise[];
}) {
  const normalizedNotes = params.notes.trim() || null;
  const normalizedName = params.name.trim();

  if (!normalizedName) {
    throw new Error('Routine name is required');
  }

  if (params.exercises.length === 0) {
    throw new Error('Add at least one exercise');
  }

  const invalidExercise = params.exercises.find((exercise) => !exercise.name.trim());
  if (invalidExercise) {
    throw new Error('Every exercise needs a name');
  }

  const routine =
    params.routineId === undefined
      ? await createRoutine(params.userId, normalizedName, normalizedNotes)
      : await updateRoutine(params.routineId, normalizedName, normalizedNotes);

  await replaceRoutineExercises(routine.id, params.exercises);
  await replaceRoutineSchedule(routine.id, params.weekdays);

  return routine;
}

async function createRoutine(userId: string, name: string, notes: string | null) {
  const { data, error } = await supabase
    .from('routines')
    .insert({ user_id: userId, name, notes })
    .select('*')
    .single();

  if (error) {
    raise(error);
  }

  return data as Routine;
}

async function updateRoutine(routineId: string, name: string, notes: string | null) {
  const { data, error } = await supabase
    .from('routines')
    .update({ name, notes })
    .eq('id', routineId)
    .select('*')
    .single();

  if (error) {
    raise(error);
  }

  return data as Routine;
}

async function replaceRoutineExercises(routineId: string, exercises: EditableExercise[]) {
  const { error: deleteError } = await supabase.from('routine_exercises').delete().eq('routine_id', routineId);

  if (deleteError) {
    raise(deleteError);
  }

  const rows = exercises.map((exercise, index) => {
    const setGroups = normalizeSetGroups(exercise.setGroups);
    const firstGroup = getFirstSetGroup(setGroups);

    return {
      routine_id: routineId,
      name: exercise.name.trim(),
      reps: firstGroup.reps,
      sets: getTotalSets(setGroups),
      set_groups: setGroups,
      sort_order: index,
    };
  });

  const { error: insertError } = await supabase.from('routine_exercises').insert(rows);

  if (insertError) {
    raise(insertError);
  }
}

async function replaceRoutineSchedule(routineId: string, weekdays: Weekday[]) {
  const { error: deleteError } = await supabase.from('routine_schedule').delete().eq('routine_id', routineId);

  if (deleteError) {
    raise(deleteError);
  }

  if (weekdays.length === 0) {
    return;
  }

  const rows = weekdays.map((weekday) => ({
    routine_id: routineId,
    weekday,
    is_active: true,
  }));

  const { error: insertError } = await supabase.from('routine_schedule').insert(rows);

  if (insertError) {
    raise(insertError);
  }
}

export async function deleteRoutine(routineId: string) {
  const { error } = await supabase.from('routines').delete().eq('id', routineId);

  if (error) {
    raise(error);
  }
}

export async function deleteWorkoutSession(sessionId: string) {
  const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);

  if (error) {
    raise(error);
  }
}

/**
 * Reverts a routine that was marked complete today back to pending by removing
 * its completed session for the date. The associated exercise logs are removed
 * automatically via the `on delete cascade` foreign key on
 * `workout_exercise_logs`.
 */
export async function markRoutineIncomplete(params: {
  userId: string;
  routineId: string;
  scheduledDate: string;
}) {
  const { error } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('user_id', params.userId)
    .eq('routine_id', params.routineId)
    .eq('scheduled_date', params.scheduledDate)
    .eq('status', 'completed');

  if (error) {
    raise(error);
  }
}

export async function fetchCompletedRoutineIdsForDate(userId: string, scheduledDate: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('routine_id')
    .eq('user_id', userId)
    .eq('scheduled_date', scheduledDate)
    .eq('status', 'completed')
    .not('routine_id', 'is', null);

  if (error) {
    raise(error);
  }

  const routineIds = ((data ?? []) as Pick<WorkoutSession, 'routine_id'>[])
    .map((session) => session.routine_id)
    .filter((routineId): routineId is string => Boolean(routineId));

  return [...new Set(routineIds)];
}

type WorkoutHistoryRow = WorkoutSession & {
  routines: { name: string } | null;
  workout_exercise_logs: WorkoutExerciseLog[] | null;
};

type ExerciseProgressRow = WorkoutExerciseLog & {
  workout_sessions: (Pick<
    WorkoutSession,
    'id' | 'routine_id' | 'title' | 'scheduled_date' | 'completed_at' | 'status' | 'user_id'
  > & {
    routines: { name: string } | null;
  }) | null;
};

function mapWorkoutHistoryRows(rows: WorkoutHistoryRow[]): WorkoutHistorySession[] {
  return rows.map((session) => ({
    ...session,
    routine_name: session.routines?.name ?? null,
    logs: (session.workout_exercise_logs ?? []).map(normalizeWorkoutLog),
  }));
}

export async function fetchWorkoutHistory(userId: string): Promise<WorkoutHistorySession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      `
        *,
        routines(name),
        workout_exercise_logs(*)
      `,
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('scheduled_date', { ascending: false })
    .order('completed_at', { ascending: false })
    .limit(100);

  if (error) {
    raise(error);
  }

  return mapWorkoutHistoryRows((data ?? []) as WorkoutHistoryRow[]);
}

function normalizeExerciseName(name: string) {
  return name.trim().toLowerCase();
}

function getWorkoutNameForProgress(session: ExerciseProgressRow['workout_sessions']) {
  return session?.routines?.name ?? session?.title ?? 'Deleted routine';
}

function getProgressTotals(setGroups: Array<{ reps: number; sets: number }>) {
  return setGroups.reduce(
    (totals, group) => ({
      totalSets: totals.totalSets + group.sets,
      totalReps: totals.totalReps + group.sets * group.reps,
    }),
    { totalSets: 0, totalReps: 0 },
  );
}

function sortProgressEntries(entries: ExerciseProgressEntry[]) {
  return [...entries].sort((a, b) => {
    const dateDiff = b.scheduledDate.localeCompare(a.scheduledDate);

    if (dateDiff !== 0) {
      return dateDiff;
    }

    const aCompleted = a.completedAt ?? '';
    const bCompleted = b.completedAt ?? '';
    return bCompleted.localeCompare(aCompleted);
  });
}

function getTrend(entries: ExerciseProgressEntry[]): ExerciseProgressTrend {
  if (entries.length < 2) {
    return 'flat';
  }

  const [latest, previous] = entries;

  if (latest.totalReps > previous.totalReps) {
    return 'up';
  }

  if (latest.totalReps < previous.totalReps) {
    return 'down';
  }

  return 'flat';
}

function mapExerciseProgressRows(rows: ExerciseProgressRow[]): ExerciseProgressSummary[] {
  const groups = new Map<string, { exerciseName: string; entries: ExerciseProgressEntry[] }>();

  rows.forEach((row) => {
    const key = normalizeExerciseName(row.name);
    const session = row.workout_sessions;

    if (!key || !session) {
      return;
    }

    const actualSetGroups = normalizeSetGroups(row.actual_set_groups, {
      reps: row.actual_reps,
      sets: row.actual_sets,
    });
    const totals = getProgressTotals(actualSetGroups);
    const current = groups.get(key) ?? { exerciseName: row.name.trim(), entries: [] };

    groups.set(key, {
      exerciseName: current.exerciseName,
      entries: [
        ...current.entries,
        {
          id: row.id,
          exerciseName: row.name.trim(),
          scheduledDate: session.scheduled_date,
          completedAt: session.completed_at,
          sessionId: session.id,
          workoutName: getWorkoutNameForProgress(session),
          actualSetGroups,
          totalSets: totals.totalSets,
          totalReps: totals.totalReps,
        },
      ],
    });
  });

  return Array.from(groups.values())
    .map((group) => {
      const entries = sortProgressEntries(group.entries);
      const bestTotalReps = Math.max(...entries.map((entry) => entry.totalReps));

      return {
        exerciseName: entries[0]?.exerciseName ?? group.exerciseName,
        entries,
        entryCount: entries.length,
        lastTotalReps: entries[0]?.totalReps ?? 0,
        bestTotalReps: Number.isFinite(bestTotalReps) ? bestTotalReps : 0,
        trend: getTrend(entries),
      };
    })
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

export async function fetchExerciseProgress(userId: string): Promise<ExerciseProgressSummary[]> {
  const { data, error } = await supabase
    .from('workout_exercise_logs')
    .select(
      `
        *,
        workout_sessions!inner(
          id,
          routine_id,
          title,
          scheduled_date,
          completed_at,
          status,
          user_id,
          routines(name)
        )
      `,
    )
    .eq('workout_sessions.user_id', userId)
    .eq('workout_sessions.status', 'completed');

  if (error) {
    raise(error);
  }

  return mapExerciseProgressRows((data ?? []) as ExerciseProgressRow[]);
}

export async function fetchCompletedWorkoutsForDate(
  userId: string,
  scheduledDate: string,
): Promise<WorkoutHistorySession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      `
        *,
        routines(name),
        workout_exercise_logs(*)
      `,
    )
    .eq('user_id', userId)
    .eq('scheduled_date', scheduledDate)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(100);

  if (error) {
    raise(error);
  }

  return mapWorkoutHistoryRows((data ?? []) as WorkoutHistoryRow[]);
}

export async function fetchWorkoutSessionById(userId: string, sessionId: string): Promise<WorkoutHistorySession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      `
        *,
        routines(name),
        workout_exercise_logs(*)
      `,
    )
    .eq('user_id', userId)
    .eq('id', sessionId)
    .eq('status', 'completed')
    .single();

  if (error) {
    raise(error);
  }

  return mapWorkoutHistoryRows([data as WorkoutHistoryRow])[0];
}

function buildWorkoutLogRow(sessionId: string, log: WorkoutExerciseLogInput) {
  const plannedSetGroups = normalizeSetGroups(log.plannedSetGroups, {
    reps: log.plannedReps,
    sets: log.plannedSets,
  });
  const actualSetGroups = normalizeSetGroups(log.actualSetGroups, {
    reps: log.actualReps,
    sets: log.actualSets,
  });
  const plannedFirstGroup = getFirstSetGroup(plannedSetGroups);
  const actualFirstGroup = getFirstSetGroup(actualSetGroups);

  return {
    workout_session_id: sessionId,
    routine_exercise_id: log.routineExerciseId,
    name: log.name.trim(),
    planned_reps: plannedFirstGroup.reps,
    planned_sets: getTotalSets(plannedSetGroups),
    planned_set_groups: plannedSetGroups,
    actual_reps: actualFirstGroup.reps,
    actual_sets: getTotalSets(actualSetGroups),
    actual_set_groups: actualSetGroups,
    notes: log.notes.trim() || null,
  };
}

function buildWorkoutLogRows(sessionId: string, logs: WorkoutExerciseLogInput[]) {
  return logs.map((log) => buildWorkoutLogRow(sessionId, log));
}

export async function completeWorkout(params: {
  userId: string;
  routineId: string;
  scheduledDate: string;
  logs: WorkoutExerciseLogInput[];
}) {
  const { data: session, error: sessionError } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: params.userId,
      routine_id: params.routineId,
      scheduled_date: params.scheduledDate,
      completed_at: new Date().toISOString(),
      status: 'completed',
    })
    .select('*')
    .single();

  if (sessionError) {
    raise(sessionError);
  }

  const { error: logsError } = await supabase
    .from('workout_exercise_logs')
    .insert(buildWorkoutLogRows(session.id, params.logs));

  if (logsError) {
    raise(logsError);
  }

  return session;
}

/**
 * Logs an ad-hoc workout that is not tied to a saved routine (a temporal
 * routine for the day, or a single exercise done to failure). The session is
 * stored with `routine_id = null` and a free-text `title` so it still shows a
 * meaningful name in history.
 */
export async function logAdHocWorkout(params: {
  userId: string;
  title: string;
  scheduledDate: string;
  logs: WorkoutExerciseLogInput[];
}) {
  const title = params.title.trim();

  if (!title) {
    throw new Error('A title is required');
  }

  if (params.logs.length === 0) {
    throw new Error('Add at least one exercise');
  }

  const { data: session, error: sessionError } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: params.userId,
      routine_id: null,
      title,
      scheduled_date: params.scheduledDate,
      completed_at: new Date().toISOString(),
      status: 'completed',
    })
    .select('*')
    .single();

  if (sessionError) {
    raise(sessionError);
  }

  const { error: logsError } = await supabase
    .from('workout_exercise_logs')
    .insert(buildWorkoutLogRows(session.id, params.logs));

  if (logsError) {
    raise(logsError);
  }

  return session;
}

export async function updateWorkoutSessionLogs(params: {
  sessionId: string;
  title: string | null;
  logs: Array<WorkoutExerciseLogInput & { logId: string }>;
}) {
  const title = params.title?.trim() || null;

  if (params.logs.length === 0) {
    throw new Error('Add at least one exercise');
  }

  const invalidLog = params.logs.find((log) => !log.name.trim());
  if (invalidLog) {
    throw new Error('Every exercise needs a name');
  }

  const { error: sessionError } = await supabase
    .from('workout_sessions')
    .update({ title })
    .eq('id', params.sessionId);

  if (sessionError) {
    raise(sessionError);
  }

  await Promise.all(
    params.logs.map(async (log) => {
      const { error } = await supabase
        .from('workout_exercise_logs')
        .update(buildWorkoutLogRow(params.sessionId, log))
        .eq('id', log.logId)
        .eq('workout_session_id', params.sessionId);

      if (error) {
        raise(error);
      }
    }),
  );
}
