export type RootStackParamList = {
  MainTabs: undefined;
  RoutineEditor: { routineId?: string } | undefined;
  Workout: { routineId: string };
};

export type MainTabParamList = {
  Today: undefined;
  Routines: undefined;
  Profile: undefined;
};
