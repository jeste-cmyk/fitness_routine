import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { getLocalDateString, getTodayWeekday } from '../lib/date';
import { formatSetGroups, getExerciseSetGroups, getFirstSetGroup, getTotalSets } from '../lib/exercisePlan';
import { completeWorkout, fetchCompletedRoutineIdsForDate, fetchRoutineDetails } from '../lib/routines';
import { RoutineWithDetails, WEEKDAYS } from '../lib/types';
import { RootStackParamList } from '../navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type TodayFilter = 'pending' | 'completed';

export function TodayScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const [routines, setRoutines] = useState<RoutineWithDetails[]>([]);
  const [completedRoutineIds, setCompletedRoutineIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<TodayFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRoutineId, setSavingRoutineId] = useState<string | null>(null);
  const today = getTodayWeekday();
  const scheduledDate = getLocalDateString();
  const todayLabel = WEEKDAYS.find((weekday) => weekday.value === today)?.label ?? 'Today';
  const completedRoutineIdSet = useMemo(() => new Set(completedRoutineIds), [completedRoutineIds]);
  const visibleRoutines = useMemo(
    () =>
      routines.filter((routine) =>
        filter === 'pending' ? !completedRoutineIdSet.has(routine.id) : completedRoutineIdSet.has(routine.id),
      ),
    [completedRoutineIdSet, filter, routines],
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
          title: 'No completed routines',
          message: 'Complete a routine today and it will appear in this filtered view.',
        };

  const load = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const [data, completedIds] = await Promise.all([
        fetchRoutineDetails(user.id),
        fetchCompletedRoutineIdsForDate(user.id, scheduledDate),
      ]);
      setRoutines(data.filter((routine) => routine.schedule.some((item) => item.weekday === today && item.is_active)));
      setCompletedRoutineIds(completedIds);
    } catch (error) {
      Alert.alert('Could not load today', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scheduledDate, today, user]);

  async function markRoutineComplete(routine: RoutineWithDetails) {
    if (!user) {
      return;
    }

    try {
      setSavingRoutineId(routine.id);
      await completeWorkout({
        userId: user.id,
        routineId: routine.id,
        scheduledDate: getLocalDateString(),
        logs: routine.exercises.map((exercise) => {
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
        }),
      });
      setCompletedRoutineIds((current) => (current.includes(routine.id) ? current : [...current, routine.id]));
      Alert.alert('Routine completed', 'Saved with the planned reps and sets.');
    } catch (error) {
      Alert.alert('Could not complete routine', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingRoutineId(null);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
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

      {!loading && visibleRoutines.length === 0 ? (
        <EmptyState title={emptyState.title} message={emptyState.message} />
      ) : null}

      {visibleRoutines.map((routine) => (
        <View key={routine.id} style={styles.card}>
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
                disabled={savingRoutineId !== null}
                label="Modify routine for today"
                onPress={() => navigation.navigate('Workout', { routineId: routine.id })}
                variant="secondary"
              />
              <AppButton
                label="Mark routine as complete"
                loading={savingRoutineId === routine.id}
                onPress={() => markRoutineComplete(routine)}
              />
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
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
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 32,
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
  title: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '900',
  },
});
