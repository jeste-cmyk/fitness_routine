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

export type EditableExercise = {
  id?: string;
  name: string;
  reps: number;
  sets: number;
};

export type WorkoutExerciseLogInput = {
  routineExerciseId: string | null;
  name: string;
  plannedReps: number;
  plannedSets: number;
  actualReps: number;
  actualSets: number;
  notes: string;
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
