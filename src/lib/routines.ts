import { supabase } from './supabase';
import { getFirstSetGroup, getTotalSets, normalizeSetGroups } from './exercisePlan';
import {
  EditableExercise,
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

  return ((data ?? []) as WorkoutHistoryRow[]).map((session) => ({
    ...session,
    routine_name: session.routines?.name ?? null,
    logs: (session.workout_exercise_logs ?? []).map(normalizeWorkoutLog),
  }));
}

function buildWorkoutLogRows(sessionId: string, logs: WorkoutExerciseLogInput[]) {
  return logs.map((log) => {
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
      name: log.name,
      planned_reps: plannedFirstGroup.reps,
      planned_sets: getTotalSets(plannedSetGroups),
      planned_set_groups: plannedSetGroups,
      actual_reps: actualFirstGroup.reps,
      actual_sets: getTotalSets(actualSetGroups),
      actual_set_groups: actualSetGroups,
      notes: log.notes.trim() || null,
    };
  });
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
