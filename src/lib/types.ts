export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Routine = {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RoutineExercise = {
  id: string;
  routine_id: string;
  name: string;
  reps: number;
  sets: number;
  set_groups: RepSetGroup[];
  sort_order: number;
};

export type RoutineSchedule = {
  id: string;
  routine_id: string;
  weekday: Weekday;
  is_active: boolean;
};

export type RoutineWithDetails = Routine & {
  exercises: RoutineExercise[];
  schedule: RoutineSchedule[];
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  routine_id: string | null;
  scheduled_date: string;
  started_at: string;
  completed_at: string | null;
  status: 'started' | 'completed';
};

export type WorkoutExerciseLog = {
  id: string;
  workout_session_id: string;
  routine_exercise_id: string | null;
  name: string;
  planned_reps: number;
  planned_sets: number;
  planned_set_groups: RepSetGroup[] | null;
  actual_reps: number;
  actual_sets: number;
  actual_set_groups: RepSetGroup[] | null;
  notes: string | null;
};

export type WorkoutHistorySession = WorkoutSession & {
  routine_name: string | null;
  logs: WorkoutExerciseLog[];
};

export type EditableExercise = {
  id?: string;
  name: string;
  setGroups: RepSetGroup[];
};

export type WorkoutExerciseLogInput = {
  routineExerciseId: string | null;
  name: string;
  plannedReps: number;
  plannedSets: number;
  plannedSetGroups: RepSetGroup[];
  actualReps: number;
  actualSets: number;
  actualSetGroups: RepSetGroup[];
  notes: string;
};

export type RepSetGroup = {
  reps: number;
  sets: number;
};

export const WEEKDAYS: Array<{ value: Weekday; short: string; label: string }> = [
  { value: 0, short: 'Sun', label: 'Sunday' },
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
];
