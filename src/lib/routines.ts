import { supabase } from './supabase';
import {
  EditableExercise,
  Routine,
  RoutineExercise,
  RoutineSchedule,
  RoutineWithDetails,
  Weekday,
  WorkoutExerciseLogInput,
} from './types';

function raise(error: unknown): never {
  if (error instanceof Error) {
    throw error;
  }

  throw new Error('Unexpected data error');
}

function sortExercises(exercises: RoutineExercise[]) {
  return [...exercises].sort((a, b) => a.sort_order - b.sort_order);
}

function composeRoutineDetails(
  routines: Routine[],
  exercises: RoutineExercise[],
  schedules: RoutineSchedule[],
): RoutineWithDetails[] {
  return routines.map((routine) => ({
    ...routine,
    exercises: sortExercises(exercises.filter((exercise) => exercise.routine_id === routine.id)),
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

  const rows = exercises.map((exercise, index) => ({
    routine_id: routineId,
    name: exercise.name.trim(),
    reps: Math.max(1, Math.trunc(exercise.reps)),
    sets: Math.max(1, Math.trunc(exercise.sets)),
    sort_order: index,
  }));

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

  const rows = params.logs.map((log) => ({
    workout_session_id: session.id,
    routine_exercise_id: log.routineExerciseId,
    name: log.name,
    planned_reps: log.plannedReps,
    planned_sets: log.plannedSets,
    actual_reps: Math.max(1, Math.trunc(log.actualReps)),
    actual_sets: Math.max(1, Math.trunc(log.actualSets)),
    notes: log.notes.trim() || null,
  }));

  const { error: logsError } = await supabase.from('workout_exercise_logs').insert(rows);

  if (logsError) {
    raise(logsError);
  }

  return session;
}
