// Route the data layer through the controllable mock instead of a real client.
jest.mock('../supabase', () => require('../../test-utils/supabaseMock'));

import {
  completeWorkout,
  deleteRoutine,
  deleteWorkoutSession,
  fetchCompletedWorkoutsForDate,
  fetchCompletedRoutineIdsForDate,
  fetchRoutineById,
  fetchRoutineDetails,
  fetchWorkoutHistory,
  logAdHocWorkout,
  markRoutineIncomplete,
  saveRoutineDetails,
} from '../routines';
import { __reset, __setResponses, calls } from '../../test-utils/supabaseMock';
import type { EditableExercise, WorkoutExerciseLogInput } from '../types';

beforeEach(() => {
  __reset();
});

/** Finds the first recorded call for a given table + operation. */
function callFor(table: string, operation: string) {
  return calls.find((entry) => entry.table === table && entry.operation === operation);
}

function findChain(call: ReturnType<typeof callFor>, method: string) {
  return call?.chain.find((step) => step.method === method);
}

const sampleExercise = (overrides: Partial<EditableExercise> = {}): EditableExercise => ({
  name: 'Bench press',
  setGroups: [{ reps: 10, sets: 3 }],
  ...overrides,
});

const sampleLog = (overrides: Partial<WorkoutExerciseLogInput> = {}): WorkoutExerciseLogInput => ({
  routineExerciseId: 're-1',
  name: 'Bench press',
  plannedReps: 10,
  plannedSets: 3,
  plannedSetGroups: [{ reps: 10, sets: 3 }],
  actualReps: 8,
  actualSets: 3,
  actualSetGroups: [{ reps: 8, sets: 3 }],
  notes: '',
  ...overrides,
});

describe('saveRoutineDetails — validation', () => {
  it('rejects a blank routine name', async () => {
    await expect(
      saveRoutineDetails({
        userId: 'u1',
        name: '   ',
        notes: '',
        weekdays: [],
        exercises: [sampleExercise()],
      }),
    ).rejects.toThrow('Routine name is required');
    expect(calls).toHaveLength(0);
  });

  it('rejects when there are no exercises', async () => {
    await expect(
      saveRoutineDetails({
        userId: 'u1',
        name: 'Push day',
        notes: '',
        weekdays: [1],
        exercises: [],
      }),
    ).rejects.toThrow('Add at least one exercise');
  });

  it('rejects when an exercise has no name', async () => {
    await expect(
      saveRoutineDetails({
        userId: 'u1',
        name: 'Push day',
        notes: '',
        weekdays: [1],
        exercises: [sampleExercise({ name: '  ' })],
      }),
    ).rejects.toThrow('Every exercise needs a name');
  });
});

describe('saveRoutineDetails — creating a routine', () => {
  it('inserts the routine, its exercises and schedule', async () => {
    __setResponses({
      'routines.insert': { data: { id: 'r1', user_id: 'u1', name: 'Push day' }, error: null },
      'routine_exercises.delete': { data: null, error: null },
      'routine_exercises.insert': { data: null, error: null },
      'routine_schedule.delete': { data: null, error: null },
      'routine_schedule.insert': { data: null, error: null },
    });

    const routine = await saveRoutineDetails({
      userId: 'u1',
      name: '  Push day  ',
      notes: '  heavy  ',
      weekdays: [1, 3],
      exercises: [
        sampleExercise({ name: '  Bench press  ', setGroups: [{ reps: 10, sets: 3 }, { reps: 8, sets: 2 }] }),
        sampleExercise({ name: 'Incline press', setGroups: [{ reps: 12, sets: 4 }] }),
      ],
    });

    expect(routine).toEqual({ id: 'r1', user_id: 'u1', name: 'Push day' });

    // Routine row: trimmed name and trimmed notes.
    const insertRoutine = callFor('routines', 'insert');
    expect(insertRoutine?.payload).toEqual({ user_id: 'u1', name: 'Push day', notes: 'heavy' });

    // Exercise rows: trimmed names, derived reps/sets, set_groups and sort_order.
    const insertExercises = callFor('routine_exercises', 'insert');
    expect(insertExercises?.payload).toEqual([
      {
        routine_id: 'r1',
        name: 'Bench press',
        reps: 10,
        sets: 5,
        set_groups: [{ reps: 10, sets: 3 }, { reps: 8, sets: 2 }],
        sort_order: 0,
      },
      {
        routine_id: 'r1',
        name: 'Incline press',
        reps: 12,
        sets: 4,
        set_groups: [{ reps: 12, sets: 4 }],
        sort_order: 1,
      },
    ]);

    // Schedule rows for each selected weekday.
    const insertSchedule = callFor('routine_schedule', 'insert');
    expect(insertSchedule?.payload).toEqual([
      { routine_id: 'r1', weekday: 1, is_active: true },
      { routine_id: 'r1', weekday: 3, is_active: true },
    ]);
  });

  it('stores null notes when notes are blank', async () => {
    __setResponses({
      'routines.insert': { data: { id: 'r1' }, error: null },
    });

    await saveRoutineDetails({
      userId: 'u1',
      name: 'Legs',
      notes: '   ',
      weekdays: [],
      exercises: [sampleExercise()],
    });

    expect(callFor('routines', 'insert')?.payload).toMatchObject({ notes: null });
  });

  it('skips inserting schedule rows when no weekdays are selected', async () => {
    __setResponses({
      'routines.insert': { data: { id: 'r1' }, error: null },
    });

    await saveRoutineDetails({
      userId: 'u1',
      name: 'Legs',
      notes: '',
      weekdays: [],
      exercises: [sampleExercise()],
    });

    // The schedule is cleared (delete) but no insert happens.
    expect(callFor('routine_schedule', 'delete')).toBeDefined();
    expect(callFor('routine_schedule', 'insert')).toBeUndefined();
  });
});

describe('saveRoutineDetails — updating a routine', () => {
  it('updates the existing routine instead of inserting', async () => {
    __setResponses({
      'routines.update': { data: { id: 'r9', name: 'Updated' }, error: null },
    });

    const routine = await saveRoutineDetails({
      routineId: 'r9',
      userId: 'u1',
      name: 'Updated',
      notes: '',
      weekdays: [2],
      exercises: [sampleExercise()],
    });

    expect(routine).toEqual({ id: 'r9', name: 'Updated' });
    expect(callFor('routines', 'insert')).toBeUndefined();

    const update = callFor('routines', 'update');
    expect(update?.payload).toEqual({ name: 'Updated', notes: null });
    expect(findChain(update, 'eq')?.args).toEqual(['id', 'r9']);
  });
});

describe('deleteRoutine', () => {
  it('deletes the routine by id', async () => {
    __setResponses({ 'routines.delete': { data: null, error: null } });

    await deleteRoutine('r1');

    const del = callFor('routines', 'delete');
    expect(del).toBeDefined();
    expect(findChain(del, 'eq')?.args).toEqual(['id', 'r1']);
  });

  it('surfaces a Postgrest-style error with code', async () => {
    __setResponses({
      'routines.delete': { data: null, error: { message: 'permission denied', code: '42501' } },
    });

    await expect(deleteRoutine('r1')).rejects.toThrow('permission denied (42501)');
  });
});

describe('deleteWorkoutSession', () => {
  it('deletes the session by id', async () => {
    __setResponses({ 'workout_sessions.delete': { data: null, error: null } });

    await deleteWorkoutSession('s1');

    const del = callFor('workout_sessions', 'delete');
    expect(findChain(del, 'eq')?.args).toEqual(['id', 's1']);
  });
});

describe('markRoutineIncomplete', () => {
  it('deletes the completed session for the given user/routine/date', async () => {
    __setResponses({ 'workout_sessions.delete': { data: null, error: null } });

    await markRoutineIncomplete({ userId: 'u1', routineId: 'r1', scheduledDate: '2026-06-28' });

    const del = callFor('workout_sessions', 'delete');
    const eqArgs = del?.chain.filter((c) => c.method === 'eq').map((c) => c.args);
    expect(eqArgs).toEqual([
      ['user_id', 'u1'],
      ['routine_id', 'r1'],
      ['scheduled_date', '2026-06-28'],
      ['status', 'completed'],
    ]);
  });
});

describe('fetchCompletedRoutineIdsForDate', () => {
  it('returns unique routine ids, dropping nulls', async () => {
    __setResponses({
      'workout_sessions.select': {
        data: [
          { routine_id: 'r1' },
          { routine_id: 'r2' },
          { routine_id: 'r1' },
          { routine_id: null },
        ],
        error: null,
      },
    });

    const ids = await fetchCompletedRoutineIdsForDate('u1', '2026-06-28');
    expect(ids.sort()).toEqual(['r1', 'r2']);
  });

  it('returns an empty array when nothing is completed', async () => {
    __setResponses({ 'workout_sessions.select': { data: [], error: null } });
    expect(await fetchCompletedRoutineIdsForDate('u1', '2026-06-28')).toEqual([]);
  });
});

describe('fetchCompletedWorkoutsForDate', () => {
  it('returns completed sessions for the requested date, including ad-hoc workouts', async () => {
    __setResponses({
      'workout_sessions.select': {
        data: [
          {
            id: 's1',
            user_id: 'u1',
            routine_id: null,
            title: 'Volley',
            scheduled_date: '2026-06-28',
            completed_at: '2026-06-28T23:37:00.000Z',
            status: 'completed',
            routines: null,
            workout_exercise_logs: [
              {
                id: 'l1',
                workout_session_id: 's1',
                routine_exercise_id: null,
                name: 'Volley',
                planned_reps: 60,
                planned_sets: 1,
                planned_set_groups: null,
                actual_reps: 60,
                actual_sets: 1,
                actual_set_groups: null,
                notes: 'To failure',
              },
            ],
          },
        ],
        error: null,
      },
    });

    const workouts = await fetchCompletedWorkoutsForDate('u1', '2026-06-28');

    expect(workouts).toHaveLength(1);
    expect(workouts[0].title).toBe('Volley');
    expect(workouts[0].routine_name).toBeNull();
    expect(workouts[0].logs[0].actual_set_groups).toEqual([{ reps: 60, sets: 1 }]);

    const select = callFor('workout_sessions', 'select');
    const eqArgs = select?.chain.filter((c) => c.method === 'eq').map((c) => c.args);
    expect(eqArgs).toEqual([
      ['user_id', 'u1'],
      ['scheduled_date', '2026-06-28'],
      ['status', 'completed'],
    ]);
  });
});

describe('completeWorkout', () => {
  it('creates a completed session and inserts exercise logs', async () => {
    __setResponses({
      'workout_sessions.insert': { data: { id: 's1', status: 'completed' }, error: null },
      'workout_exercise_logs.insert': { data: null, error: null },
    });

    const session = await completeWorkout({
      userId: 'u1',
      routineId: 'r1',
      scheduledDate: '2026-06-28',
      logs: [sampleLog({ notes: '  felt strong  ' })],
    });

    expect(session).toEqual({ id: 's1', status: 'completed' });

    const sessionInsert = callFor('workout_sessions', 'insert');
    expect(sessionInsert?.payload).toMatchObject({
      user_id: 'u1',
      routine_id: 'r1',
      scheduled_date: '2026-06-28',
      status: 'completed',
    });
    expect((sessionInsert?.payload as { completed_at: string }).completed_at).toEqual(expect.any(String));

    const logsInsert = callFor('workout_exercise_logs', 'insert');
    expect(logsInsert?.payload).toEqual([
      {
        workout_session_id: 's1',
        routine_exercise_id: 're-1',
        name: 'Bench press',
        planned_reps: 10,
        planned_sets: 3,
        planned_set_groups: [{ reps: 10, sets: 3 }],
        actual_reps: 8,
        actual_sets: 3,
        actual_set_groups: [{ reps: 8, sets: 3 }],
        notes: 'felt strong',
      },
    ]);
  });

  it('stores null notes when the note is blank', async () => {
    __setResponses({
      'workout_sessions.insert': { data: { id: 's1' }, error: null },
      'workout_exercise_logs.insert': { data: null, error: null },
    });

    await completeWorkout({
      userId: 'u1',
      routineId: 'r1',
      scheduledDate: '2026-06-28',
      logs: [sampleLog({ notes: '   ' })],
    });

    const logsInsert = callFor('workout_exercise_logs', 'insert');
    expect((logsInsert?.payload as Array<{ notes: unknown }>)[0].notes).toBeNull();
  });

  it('propagates an error raised while inserting the session', async () => {
    __setResponses({
      'workout_sessions.insert': { data: null, error: { message: 'insert failed' } },
    });

    await expect(
      completeWorkout({ userId: 'u1', routineId: 'r1', scheduledDate: '2026-06-28', logs: [sampleLog()] }),
    ).rejects.toThrow('insert failed');
  });
});

describe('logAdHocWorkout', () => {
  it('requires a title', async () => {
    await expect(
      logAdHocWorkout({ userId: 'u1', title: '   ', scheduledDate: '2026-06-28', logs: [sampleLog()] }),
    ).rejects.toThrow('A title is required');
  });

  it('requires at least one exercise log', async () => {
    await expect(
      logAdHocWorkout({ userId: 'u1', title: 'Quick burn', scheduledDate: '2026-06-28', logs: [] }),
    ).rejects.toThrow('Add at least one exercise');
  });

  it('inserts a session with a null routine_id and trimmed title', async () => {
    __setResponses({
      'workout_sessions.insert': { data: { id: 's2', title: 'Quick burn' }, error: null },
      'workout_exercise_logs.insert': { data: null, error: null },
    });

    const session = await logAdHocWorkout({
      userId: 'u1',
      title: '  Quick burn  ',
      scheduledDate: '2026-06-28',
      logs: [sampleLog({ routineExerciseId: null })],
    });

    expect(session).toEqual({ id: 's2', title: 'Quick burn' });

    const sessionInsert = callFor('workout_sessions', 'insert');
    expect(sessionInsert?.payload).toMatchObject({
      user_id: 'u1',
      routine_id: null,
      title: 'Quick burn',
      scheduled_date: '2026-06-28',
      status: 'completed',
    });

    const logsInsert = callFor('workout_exercise_logs', 'insert');
    expect((logsInsert?.payload as Array<{ routine_exercise_id: unknown }>)[0].routine_exercise_id).toBeNull();
  });
});

describe('fetchRoutineDetails', () => {
  it('returns an empty array when the user has no routines', async () => {
    __setResponses({ 'routines.select': { data: [], error: null } });

    expect(await fetchRoutineDetails('u1')).toEqual([]);
    // Should short-circuit before querying exercises / schedule.
    expect(callFor('routine_exercises', 'select')).toBeUndefined();
    expect(callFor('routine_schedule', 'select')).toBeUndefined();
  });

  it('composes routines with sorted exercises and schedule', async () => {
    __setResponses({
      'routines.select': {
        data: [
          { id: 'r1', user_id: 'u1', name: 'Push' },
          { id: 'r2', user_id: 'u1', name: 'Pull' },
        ],
        error: null,
      },
      'routine_exercises.select': {
        data: [
          { id: 'e2', routine_id: 'r1', name: 'Second', reps: 8, sets: 2, set_groups: null, sort_order: 1 },
          { id: 'e1', routine_id: 'r1', name: 'First', reps: 10, sets: 3, set_groups: null, sort_order: 0 },
          { id: 'e3', routine_id: 'r2', name: 'Row', reps: 12, sets: 4, set_groups: null, sort_order: 0 },
        ],
        error: null,
      },
      'routine_schedule.select': {
        data: [
          { id: 's2', routine_id: 'r1', weekday: 3, is_active: true },
          { id: 's1', routine_id: 'r1', weekday: 1, is_active: true },
        ],
        error: null,
      },
    });

    const result = await fetchRoutineDetails('u1');

    expect(result).toHaveLength(2);

    const push = result.find((r) => r.id === 'r1')!;
    // Exercises sorted by sort_order.
    expect(push.exercises.map((e) => e.id)).toEqual(['e1', 'e2']);
    // Legacy reps/sets normalized into set_groups.
    expect(push.exercises[0].set_groups).toEqual([{ reps: 10, sets: 3 }]);
    // Schedule sorted by weekday.
    expect(push.schedule.map((s) => s.weekday)).toEqual([1, 3]);

    const pull = result.find((r) => r.id === 'r2')!;
    expect(pull.exercises.map((e) => e.id)).toEqual(['e3']);
    expect(pull.schedule).toEqual([]);
  });

  it('raises when fetching routines fails', async () => {
    __setResponses({ 'routines.select': { data: null, error: { message: 'boom' } } });
    await expect(fetchRoutineDetails('u1')).rejects.toThrow('boom');
  });
});

describe('fetchRoutineById', () => {
  it('returns the matching routine', async () => {
    __setResponses({
      'routines.select': { data: [{ id: 'r1', user_id: 'u1', name: 'Push' }], error: null },
      'routine_exercises.select': { data: [], error: null },
      'routine_schedule.select': { data: [], error: null },
    });

    const routine = await fetchRoutineById('u1', 'r1');
    expect(routine.id).toBe('r1');
  });

  it('throws when the routine does not exist', async () => {
    __setResponses({ 'routines.select': { data: [], error: null } });
    await expect(fetchRoutineById('u1', 'missing')).rejects.toThrow('Routine not found');
  });
});

describe('fetchWorkoutHistory', () => {
  it('maps routine name and normalizes logs', async () => {
    __setResponses({
      'workout_sessions.select': {
        data: [
          {
            id: 's1',
            user_id: 'u1',
            routine_id: 'r1',
            scheduled_date: '2026-06-28',
            status: 'completed',
            routines: { name: 'Push day' },
            workout_exercise_logs: [
              {
                id: 'l1',
                workout_session_id: 's1',
                routine_exercise_id: 're1',
                name: 'Bench',
                planned_reps: 10,
                planned_sets: 3,
                planned_set_groups: null,
                actual_reps: 8,
                actual_sets: 3,
                actual_set_groups: null,
                notes: null,
              },
            ],
          },
          {
            id: 's2',
            user_id: 'u1',
            routine_id: null,
            scheduled_date: '2026-06-27',
            status: 'completed',
            routines: null,
            workout_exercise_logs: null,
          },
        ],
        error: null,
      },
    });

    const history = await fetchWorkoutHistory('u1');

    expect(history).toHaveLength(2);
    expect(history[0].routine_name).toBe('Push day');
    // Null set groups are backfilled from the legacy reps/sets columns.
    expect(history[0].logs[0].planned_set_groups).toEqual([{ reps: 10, sets: 3 }]);
    expect(history[0].logs[0].actual_set_groups).toEqual([{ reps: 8, sets: 3 }]);
    // Ad-hoc session: no routine name, no logs.
    expect(history[1].routine_name).toBeNull();
    expect(history[1].logs).toEqual([]);
  });
});

describe('raise — error formatting', () => {
  it('joins message, details and hint', async () => {
    __setResponses({
      'routines.delete': {
        data: null,
        error: { message: 'bad', details: 'a column', hint: 'try again' },
      },
    });
    await expect(deleteRoutine('r1')).rejects.toThrow('bad — a column — try again');
  });

  it('falls back to a generic message for unknown error shapes', async () => {
    __setResponses({ 'routines.delete': { data: null, error: 'weird' } });
    await expect(deleteRoutine('r1')).rejects.toThrow('Unexpected data error');
  });
});
