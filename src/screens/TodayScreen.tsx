import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { getLocalDateString, getTodayWeekday } from '../lib/date';
import { notify } from '../lib/notify';
import { formatSetGroups, getExerciseSetGroups, getFirstSetGroup, getTotalSets, normalizeSetGroups } from '../lib/exercisePlan';
import { confirm } from '../lib/confirm';
import { completeWorkout, deleteWorkoutSession, fetchCompletedWorkoutsForDate, fetchRoutineDetails } from '../lib/routines';
import { RoutineWithDetails, WEEKDAYS, WorkoutExerciseLogInput, WorkoutHistorySession } from '../lib/types';
import { RootStackParamList } from '../navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type TodayFilter = 'pending' | 'completed';

function formatCompletedTime(value: string | null) {
  if (!value) {
    return 'Completed';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function getWorkoutName(session: WorkoutHistorySession) {
  return session.routine_name ?? session.title ?? 'Deleted routine';
}

function uniqueCompletedRoutineIds(sessions: WorkoutHistorySession[]) {
  return [
    ...new Set(
      sessions
        .map((session) => session.routine_id)
        .filter((routineId): routineId is string => Boolean(routineId)),
    ),
  ];
}

function buildOptimisticSession(params: {
  completedAt: string;
  logs: WorkoutExerciseLogInput[];
  routine: RoutineWithDetails;
  scheduledDate: string;
  sessionId: string;
  userId: string;
}): WorkoutHistorySession {
  return {
    id: params.sessionId,
    user_id: params.userId,
    routine_id: params.routine.id,
    title: null,
    scheduled_date: params.scheduledDate,
    started_at: params.completedAt,
    completed_at: params.completedAt,
    status: 'completed',
    routine_name: params.routine.name,
    logs: params.logs.map((log, index) => ({
      id: `${params.sessionId}-${index}`,
      workout_session_id: params.sessionId,
      routine_exercise_id: log.routineExerciseId,
      name: log.name,
      planned_reps: log.plannedReps,
      planned_sets: log.plannedSets,
      planned_set_groups: log.plannedSetGroups,
      actual_reps: log.actualReps,
      actual_sets: log.actualSets,
      actual_set_groups: log.actualSetGroups,
      notes: log.notes.trim() || null,
    })),
  };
}

export function TodayScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Navigation>();
  const [routines, setRoutines] = useState<RoutineWithDetails[]>([]);
  const [completedSessions, setCompletedSessions] = useState<WorkoutHistorySession[]>([]);
  const [filter, setFilter] = useState<TodayFilter>('pending');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const today = getTodayWeekday();
  const scheduledDate = getLocalDateString();
  const todayLabel = WEEKDAYS.find((weekday) => weekday.value === today)?.label ?? 'Today';
  const completedRoutineIds = useMemo(() => uniqueCompletedRoutineIds(completedSessions), [completedSessions]);
  const completedRoutineIdSet = useMemo(() => new Set(completedRoutineIds), [completedRoutineIds]);
  const pendingRoutines = useMemo(
    () => routines.filter((routine) => !completedRoutineIdSet.has(routine.id)),
    [completedRoutineIdSet, routines],
  );
  const emptyState =
    filter === 'pending'
      ? {
          title: routines.length === 0 ? 'No routines scheduled' : 'All done today',
          message:
            routines.length === 0
              ? 'Create a routine and assign it to this weekday to see it here.'
              : 'Completed routines are hidden from the main view. Use the filter to review them.',
        }
      : {
          title: 'No completed workouts',
          message: 'Complete or log a workout today and it will appear in this filtered view.',
        };

  const load = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const [data, completedToday] = await Promise.all([
        fetchRoutineDetails(user.id),
        fetchCompletedWorkoutsForDate(user.id, scheduledDate),
      ]);
      setRoutines(data.filter((routine) => routine.schedule.some((item) => item.weekday === today && item.is_active)));
      setCompletedSessions(completedToday);
    } catch (error) {
      notify('Could not load today', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scheduledDate, today, user]);

  const completeRoutine = useCallback(
    async (routine: RoutineWithDetails): Promise<WorkoutHistorySession | null> => {
      if (!user) {
        return null;
      }

      try {
        const logs = routine.exercises.map((exercise) => {
          const setGroups = getExerciseSetGroups(exercise);
          const firstGroup = getFirstSetGroup(setGroups);
          const totalSets = getTotalSets(setGroups);

          return {
            routineExerciseId: exercise.id,
            name: exercise.name,
            plannedReps: firstGroup.reps,
            plannedSets: totalSets,
            plannedSetGroups: setGroups,
            actualReps: firstGroup.reps,
            actualSets: totalSets,
            actualSetGroups: setGroups,
            notes: '',
          };
        });
        const session = await completeWorkout({
          userId: user.id,
          routineId: routine.id,
          scheduledDate,
          logs,
        });
        const completedAt = session.completed_at ?? new Date().toISOString();

        return buildOptimisticSession({
          completedAt,
          logs,
          routine,
          scheduledDate,
          sessionId: session.id,
          userId: user.id,
        });
      } catch (error) {
        notify('Could not complete routine', error instanceof Error ? error.message : 'Please try again.');
        return null;
      }
    },
    [scheduledDate, user],
  );

  // Called once the card's "fly to Completed" animation finishes, so the card
  // leaves the pending list exactly when the animation lands — no pop-up.
  const handleRoutineCompleted = useCallback((session: WorkoutHistorySession) => {
    setCompletedSessions((current) => (current.some((item) => item.id === session.id) ? current : [session, ...current]));
  }, []);

  const deleteCompletedSession = useCallback(
    async (session: WorkoutHistorySession) => {
      const workoutName = getWorkoutName(session);

      const confirmed = await confirm({
        title: session.routine_id ? 'Mark as incomplete?' : 'Delete completed workout?',
        message: `This removes today's log for "${workoutName}".`,
        confirmLabel: session.routine_id ? 'Mark incomplete' : 'Delete',
        destructive: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        setDeletingSessionId(session.id);
        await deleteWorkoutSession(session.id);
        setCompletedSessions((current) => current.filter((item) => item.id !== session.id));
      } catch (error) {
        notify('Could not update routine', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setDeletingSessionId(null);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  function openQuickLog(mode: 'routine' | 'failure') {
    setMenuOpen(false);
    navigation.navigate('QuickLog', { mode });
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          load();
        }} />}
        style={styles.container}
      >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{todayLabel}</Text>
          <Text style={styles.title}>Today</Text>
        </View>
        <View style={styles.filterGroup}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFilter('pending')}
            style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          >
            <Text style={[styles.filterLabel, filter === 'pending' && styles.filterLabelActive]}>Pending</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFilter('completed')}
            style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          >
            <Text style={[styles.filterLabel, filter === 'completed' && styles.filterLabelActive]}>Completed</Text>
          </Pressable>
        </View>
      </View>

      {loading ? <ActivityIndicator color="#0f766e" size="large" /> : null}

      {!loading && filter === 'pending' && pendingRoutines.length === 0 ? (
        <EmptyState title={emptyState.title} message={emptyState.message} />
      ) : null}

      {!loading && filter === 'completed' && completedSessions.length === 0 ? (
        <EmptyState title={emptyState.title} message={emptyState.message} />
      ) : null}

      {filter === 'pending' ? pendingRoutines.map((routine) => (
        <RoutineCard
          key={routine.id}
          filter={filter}
          onComplete={completeRoutine}
          onCompleted={handleRoutineCompleted}
          onModify={() => navigation.navigate('Workout', { routineId: routine.id })}
          routine={routine}
        />
      )) : null}

      {filter === 'completed' ? completedSessions.map((session) => (
        <CompletedWorkoutCard
          deleting={deletingSessionId === session.id}
          key={session.id}
          onDelete={deleteCompletedSession}
          session={session}
        />
      )) : null}
      </ScrollView>

      <Pressable
        accessibilityLabel="Add to today"
        accessibilityRole="button"
        onPress={() => setMenuOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" color="#ffffff" size={32} />
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setMenuOpen(false)} transparent visible={menuOpen}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Add to today</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openQuickLog('routine')}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
            >
              <Ionicons name="barbell-outline" color="#0f766e" size={24} />
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionTitle}>Temporal routine</Text>
                <Text style={styles.sheetOptionSubtitle}>A one-off routine logged just for today</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => openQuickLog('failure')}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
            >
              <Ionicons name="flame-outline" color="#0f766e" size={24} />
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionTitle}>Exercise to failure</Text>
                <Text style={styles.sheetOptionSubtitle}>Log a single exercise taken to failure</Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// Transforms/opacity can't use the native driver on react-native-web, so pick
// the driver per platform to keep the animation smooth on native and warning-
// free on web.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type RoutineCardProps = {
  routine: RoutineWithDetails;
  filter: TodayFilter;
  onModify: (routine: RoutineWithDetails) => void;
  onComplete: (routine: RoutineWithDetails) => Promise<WorkoutHistorySession | null>;
  onCompleted: (session: WorkoutHistorySession) => void;
};

function RoutineCard({ routine, filter, onModify, onComplete, onCompleted }: RoutineCardProps) {
  const [saving, setSaving] = useState(false);
  // 0 = resting in place; the fly-away animation drives these toward the
  // Completed tab (up and to the right), shrinking and fading as it goes.
  const progress = useRef(new Animated.Value(0)).current;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -160] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  async function handleComplete() {
    setSaving(true);
    const completedSession = await onComplete(routine);

    if (!completedSession) {
      setSaving(false);
      return;
    }

    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) {
        onCompleted(completedSession);
      }
    });
  }

  return (
    <Animated.View style={[styles.card, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{routine.name}</Text>
          {routine.notes ? <Text style={styles.notes}>{routine.notes}</Text> : null}
        </View>
        <Text style={filter === 'completed' ? styles.completedBadge : styles.badge}>
          {filter === 'completed' ? 'Completed today' : `${routine.exercises.length} exercises`}
        </Text>
      </View>

      <View style={styles.exerciseList}>
        {routine.exercises.map((exercise) => (
          <Text key={exercise.id} style={styles.exercise}>
            {exercise.name} - {formatSetGroups(getExerciseSetGroups(exercise))}
          </Text>
        ))}
      </View>

      {filter === 'pending' ? (
        <View style={styles.actions}>
          <AppButton
            disabled={saving}
            label="Modify routine for today"
            onPress={() => onModify(routine)}
            variant="secondary"
          />
          <AppButton label="Mark routine as complete" loading={saving} onPress={handleComplete} />
        </View>
      ) : null}
    </Animated.View>
  );
}

function CompletedWorkoutCard({
  deleting,
  onDelete,
  session,
}: {
  deleting: boolean;
  onDelete: (session: WorkoutHistorySession) => void | Promise<void>;
  session: WorkoutHistorySession;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{getWorkoutName(session)}</Text>
        </View>
        <Text style={styles.completedBadge}>{formatCompletedTime(session.completed_at)}</Text>
      </View>

      <View style={styles.exerciseList}>
        {session.logs.map((log) => {
          const actual = formatSetGroups(normalizeSetGroups(log.actual_set_groups, { reps: log.actual_reps, sets: log.actual_sets }));
          const planned = formatSetGroups(normalizeSetGroups(log.planned_set_groups, { reps: log.planned_reps, sets: log.planned_sets }));

          return (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.exercise}>
                {log.name} - {actual}
                {planned !== actual ? <Text style={styles.planned}> (planned {planned})</Text> : null}
              </Text>
              {log.notes ? <Text style={styles.notes}>{log.notes}</Text> : null}
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <AppButton
          label={session.routine_id ? 'Mark routine as incomplete' : 'Delete log'}
          loading={deleting}
          onPress={() => onDelete(session)}
          variant={session.routine_id ? 'secondary' : 'danger'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 28,
    bottom: 24,
    elevation: 6,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: 56,
  },
  fabPressed: {
    opacity: 0.85,
  },
  root: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
    padding: 20,
    paddingBottom: 32,
  },
  sheetOption: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  sheetOptionPressed: {
    opacity: 0.72,
  },
  sheetOptionSubtitle: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  sheetOptionText: {
    flex: 1,
    gap: 2,
  },
  sheetOptionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  sheetTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    color: '#92400e',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 96,
  },
  eyebrow: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  completedBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    color: '#166534',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exercise: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  exerciseList: {
    gap: 6,
  },
  filterButton: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 38,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#0f766e',
  },
  filterGroup: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    flexDirection: 'row',
    padding: 3,
  },
  filterLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  filterLabelActive: {
    color: '#ffffff',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
  },
  notes: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  logRow: {
    gap: 4,
  },
  planned: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  title: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '900',
  },
});
