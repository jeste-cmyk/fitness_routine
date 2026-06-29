import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { getLocalDateString } from '../lib/date';
import { formatSetGroups, getExerciseSetGroups, getFirstSetGroup, getTotalSets } from '../lib/exercisePlan';
import { completeWorkout, fetchRoutineById } from '../lib/routines';
import { RepSetGroup, RoutineWithDetails, WorkoutExerciseLogInput } from '../lib/types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;

type DraftLog = WorkoutExerciseLogInput & {
  key: string;
};

function parsePositiveInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

export function WorkoutScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const [routine, setRoutine] = useState<RoutineWithDetails | null>(null);
  const [logs, setLogs] = useState<DraftLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const data = await fetchRoutineById(user.id, route.params.routineId);
      setRoutine(data);
      setLogs(
        data.exercises.map((exercise) => {
          const setGroups = getExerciseSetGroups(exercise);
          const firstGroup = getFirstSetGroup(setGroups);
          const totalSets = getTotalSets(setGroups);

          return {
            key: exercise.id,
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
      );
      navigation.setOptions({ title: data.name });
    } catch (error) {
      Alert.alert('Could not load workout', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [navigation, route.params.routineId, user]);

  useEffect(() => {
    load();
  }, [load]);

  function updateLog(index: number, nextLog: DraftLog) {
    setLogs((current) => current.map((log, itemIndex) => (itemIndex === index ? nextLog : log)));
  }

  function updateActualSetGroup(logIndex: number, groupIndex: number, nextGroup: RepSetGroup) {
    setLogs((current) =>
      current.map((log, itemIndex) => {
        if (itemIndex !== logIndex) {
          return log;
        }

        const actualSetGroups = log.actualSetGroups.map((group, setIndex) =>
          setIndex === groupIndex ? nextGroup : group,
        );
        const firstGroup = getFirstSetGroup(actualSetGroups);

        return {
          ...log,
          actualReps: firstGroup.reps,
          actualSets: getTotalSets(actualSetGroups),
          actualSetGroups,
        };
      }),
    );
  }

  async function finishWorkout() {
    if (!user || !routine) {
      return;
    }

    try {
      setSaving(true);
      await completeWorkout({
        userId: user.id,
        routineId: routine.id,
        scheduledDate: getLocalDateString(),
        logs,
      });
      Alert.alert('Workout saved', 'Your adjusted reps and sets were logged.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Could not save workout', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <Text style={styles.title}>Loading workout...</Text>
      </Screen>
    );
  }

  if (!routine) {
    return (
      <Screen>
        <Text style={styles.title}>Workout unavailable</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View>
        <Text style={styles.eyebrow}>Executing</Text>
        <Text style={styles.title}>{routine.name}</Text>
      </View>

      {logs.map((log, index) => (
        <View key={log.key} style={styles.card}>
          <Text style={styles.exerciseTitle}>{log.name}</Text>
          <Text style={styles.planned}>Planned: {formatSetGroups(log.plannedSetGroups)}</Text>
          <View style={styles.actualGroups}>
            {log.actualSetGroups.map((group, groupIndex) => (
              <View key={`actual-group-${groupIndex}`} style={styles.actualGroup}>
                <Text style={styles.groupTitle}>Group {groupIndex + 1}</Text>
                <View style={styles.numberRow}>
                  <View style={styles.numberField}>
                    <Text style={styles.label}>Actual sets</Text>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={(value) =>
                        updateActualSetGroup(index, groupIndex, { ...group, sets: parsePositiveInt(value) })
                      }
                      style={styles.input}
                      value={String(group.sets)}
                    />
                  </View>
                  <View style={styles.numberField}>
                    <Text style={styles.label}>Actual reps</Text>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={(value) =>
                        updateActualSetGroup(index, groupIndex, { ...group, reps: parsePositiveInt(value) })
                      }
                      style={styles.input}
                      value={String(group.reps)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
          <TextInput
            multiline
            onChangeText={(value) => updateLog(index, { ...log, notes: value })}
            placeholder="Notes"
            placeholderTextColor="#94a3b8"
            style={[styles.input, styles.notesInput]}
            value={log.notes}
          />
        </View>
      ))}

      <AppButton label="Complete workout" loading={saving} onPress={finishWorkout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actualGroup: {
    gap: 8,
  },
  actualGroups: {
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  exerciseTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
  },
  groupTitle: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  label: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  notesInput: {
    minHeight: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  numberField: {
    flex: 1,
    minWidth: 120,
  },
  numberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  planned: {
    color: '#64748b',
    fontSize: 15,
  },
  title: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '900',
  },
});
