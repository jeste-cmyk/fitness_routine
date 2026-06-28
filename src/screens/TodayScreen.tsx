import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { getTodayWeekday } from '../lib/date';
import { fetchRoutineDetails } from '../lib/routines';
import { RoutineWithDetails, WEEKDAYS } from '../lib/types';
import { RootStackParamList } from '../navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function TodayScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const [routines, setRoutines] = useState<RoutineWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const today = getTodayWeekday();
  const todayLabel = WEEKDAYS.find((weekday) => weekday.value === today)?.label ?? 'Today';

  const load = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const data = await fetchRoutineDetails(user.id);
      setRoutines(data.filter((routine) => routine.schedule.some((item) => item.weekday === today && item.is_active)));
    } catch (error) {
      Alert.alert('Could not load today', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today, user]);

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
      <View>
        <Text style={styles.eyebrow}>{todayLabel}</Text>
        <Text style={styles.title}>Today</Text>
      </View>

      {loading ? <ActivityIndicator color="#0f766e" size="large" /> : null}

      {!loading && routines.length === 0 ? (
        <EmptyState
          title="No routines scheduled"
          message="Create a routine and assign it to this weekday to see it here."
        />
      ) : null}

      {routines.map((routine) => (
        <Pressable key={routine.id} style={styles.card} onPress={() => navigation.navigate('Workout', { routineId: routine.id })}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{routine.name}</Text>
              {routine.notes ? <Text style={styles.notes}>{routine.notes}</Text> : null}
            </View>
            <Text style={styles.badge}>{routine.exercises.length} exercises</Text>
          </View>

          <View style={styles.exerciseList}>
            {routine.exercises.map((exercise) => (
              <Text key={exercise.id} style={styles.exercise}>
                {exercise.name} - {exercise.reps} reps x {exercise.sets} sets
              </Text>
            ))}
          </View>

          <AppButton label="Start routine" onPress={() => navigation.navigate('Workout', { routineId: routine.id })} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  exercise: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  exerciseList: {
    gap: 6,
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
