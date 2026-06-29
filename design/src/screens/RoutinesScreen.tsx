import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { formatSetGroups, getExerciseSetGroups } from '../lib/exercisePlan';
import { fetchRoutineDetails } from '../lib/routines';
import { RoutineWithDetails, WEEKDAYS } from '../lib/types';
import { RootStackParamList } from '../navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function formatSchedule(routine: RoutineWithDetails) {
  const activeDays = routine.schedule.filter((item) => item.is_active).map((item) => item.weekday);

  if (activeDays.length === 0) {
    return 'Not scheduled';
  }

  return WEEKDAYS.filter((weekday) => activeDays.includes(weekday.value))
    .map((weekday) => weekday.short)
    .join(', ');
}

export function RoutinesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Navigation>();
  const [routines, setRoutines] = useState<RoutineWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setRoutines(await fetchRoutineDetails(user.id));
    } catch (error) {
      Alert.alert('Could not load routines', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
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
          <Text style={styles.eyebrow}>Library</Text>
          <Text style={styles.title}>Routines</Text>
        </View>
        <AppButton label="Add" onPress={() => navigation.navigate('RoutineEditor')} style={styles.addButton} />
      </View>

      {loading ? <ActivityIndicator color="#0f766e" size="large" /> : null}

      {!loading && routines.length === 0 ? (
        <EmptyState title="No routines yet" message="Create your first routine, add exercises, and schedule it for the week." />
      ) : null}

      {routines.map((routine) => (
        <Pressable
          key={routine.id}
          onPress={() => navigation.navigate('RoutineEditor', { routineId: routine.id })}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{routine.name}</Text>
            <Text style={styles.schedule}>{formatSchedule(routine)}</Text>
          </View>
          {routine.notes ? <Text style={styles.notes}>{routine.notes}</Text> : null}
          <View style={styles.exerciseList}>
            {routine.exercises.map((exercise) => (
              <Text key={exercise.id} style={styles.exercise}>
                {exercise.name} - {formatSetGroups(getExerciseSetGroups(exercise))}
              </Text>
            ))}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    minWidth: 84,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
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
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
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
  exercise: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  exerciseList: {
    gap: 6,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
  },
  notes: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
  },
  schedule: {
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    color: '#075985',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  title: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '900',
  },
});
