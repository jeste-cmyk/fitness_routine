export type RootStackParamList = {
  MainTabs: undefined;
  RoutineEditor: { routineId?: string } | undefined;
  Workout: { routineId: string };
  QuickLog: { mode: 'routine' | 'failure' };
};

export type MainTabParamList = {
  Today: undefined;
  Routines: undefined;
  History: undefined;
  Profile: undefined;
};
