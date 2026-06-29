import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../components/AppButton';
import { HeroHeader } from '../components/HeroHeader';
import { PositiveIntegerInput } from '../components/PositiveIntegerInput';
import { Screen } from '../components/Screen';
import { colors, radius, shadows } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { getLocalDateString } from '../lib/date';
import { formatSetGroups, getExerciseSetGroups, getFirstSetGroup, getTotalSets, normalizeSetGroups } from '../lib/exercisePlan';
import { completeWorkout, fetchRoutineById, fetchWorkoutSessionById, updateWorkoutSessionLogs } from '../lib/routines';
import { RepSetGroup, RoutineWithDetails, WorkoutExerciseLogInput, WorkoutHistorySession } from '../lib/types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;

type DraftLog = WorkoutExerciseLogInput & {
  key: string;
  logId?: string;
};

function getWorkoutName(session: WorkoutHistorySession) {
  return session.routine_name ?? session.title ?? 'Deleted routine';
}

export function WorkoutScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const routineId = 'routineId' in route.params ? route.params.routineId : null;
  const sessionId = 'sessionId' in route.params ? route.params.sessionId : null;
  const [routine, setRoutine] = useState<RoutineWithDetails | null>(null);
  const [session, setSession] = useState<WorkoutHistorySession | null>(null);
  const [title, setTitle] = useState('');
  const [logs, setLogs] = useState<DraftLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isEditingSession = sessionId !== null;

  const load = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      if (sessionId) {
        const data = await fetchWorkoutSessionById(user.id, sessionId);
        setSession(data);
        setTitle(data.title ?? '');
        setLogs(
          data.logs.map((log) => {
            const plannedSetGroups = normalizeSetGroups(log.planned_set_groups, {
              reps: log.planned_reps,
              sets: log.planned_sets,
            });
            const actualSetGroups = normalizeSetGroups(log.actual_set_groups, {
              reps: log.actual_reps,
              sets: log.actual_sets,
            });
            const plannedFirstGroup = getFirstSetGroup(plannedSetGroups);
            const actualFirstGroup = getFirstSetGroup(actualSetGroups);

            return {
              key: log.id,
              logId: log.id,
              routineExerciseId: log.routine_exercise_id,
              name: log.name,
              plannedReps: plannedFirstGroup.reps,
              plannedSets: getTotalSets(plannedSetGroups),
              plannedSetGroups,
              actualReps: actualFirstGroup.reps,
              actualSets: getTotalSets(actualSetGroups),
              actualSetGroups,
              notes: log.notes ?? '',
            };
          }),
        );
        navigation.setOptions({ title: `Edit ${getWorkoutName(data)}` });
        return;
      }

      if (!routineId) {
        throw new Error('Workout not found');
      }

      const data = await fetchRoutineById(user.id, routineId);
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
  }, [navigation, routineId, sessionId, user]);

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
    if (!user || saving) {
      return;
    }

    try {
      setSaving(true);

      if (sessionId && session) {
        if (!session.routine_id && !title.trim()) {
          Alert.alert('Workout name required', 'Enter a workout name before saving changes.');
          return;
        }

        await updateWorkoutSessionLogs({
          sessionId,
          title: session.routine_id ? session.title : title,
          logs: logs.map(({ key, ...log }) => {
            if (!log.logId) {
              throw new Error('Workout log not found');
            }

            return { ...log, logId: log.logId };
          }),
        });
        Alert.alert('Workout updated', 'Your completed workout log was updated.', [
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      if (!routine) {
        return;
      }

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
    if (isEditingSession && session) {
      return (
        <Screen>
          <HeroHeader eyebrow="Completed" title={getWorkoutName(session)} />

          {session.routine_id ? null : (
            <View style={styles.field}>
              <Text style={styles.label}>Workout name</Text>
              <TextInput
                onChangeText={setTitle}
                placeholder="Workout name"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                value={title}
              />
            </View>
          )}

          {logs.map((log, index) => (
            <View key={log.key} style={styles.card}>
              <TextInput
                onChangeText={(value) => updateLog(index, { ...log, name: value })}
                placeholder="Exercise name"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, styles.exerciseNameInput]}
                value={log.name}
              />
              <Text style={styles.planned}>Planned: {formatSetGroups(log.plannedSetGroups)}</Text>
              <View style={styles.actualGroups}>
                {log.actualSetGroups.map((group, groupIndex) => (
                  <View key={`actual-group-${groupIndex}`} style={styles.actualGroup}>
                    <Text style={styles.groupTitle}>Group {groupIndex + 1}</Text>
                    <View style={styles.numberRow}>
                      <View style={styles.numberField}>
                        <Text style={styles.label}>Actual sets</Text>
                        <PositiveIntegerInput
                          onChangeValue={(value) => updateActualSetGroup(index, groupIndex, { ...group, sets: value })}
                          style={styles.input}
                          value={group.sets}
                        />
                      </View>
                      <View style={styles.numberField}>
                        <Text style={styles.label}>Actual reps</Text>
                        <PositiveIntegerInput
                          onChangeValue={(value) => updateActualSetGroup(index, groupIndex, { ...group, reps: value })}
                          style={styles.input}
                          value={group.reps}
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
                placeholderTextColor={colors.textFaint}
                style={[styles.input, styles.notesInput]}
                value={log.notes}
              />
            </View>
          ))}

          <AppButton label="Save changes" loading={saving} onPress={finishWorkout} />
        </Screen>
      );
    }

    return (
      <Screen>
        <Text style={styles.title}>Workout unavailable</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <HeroHeader eyebrow="Executing" title={routine.name} />

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
                    <PositiveIntegerInput
                      onChangeValue={(value) => updateActualSetGroup(index, groupIndex, { ...group, sets: value })}
                      style={styles.input}
                      value={group.sets}
                    />
                  </View>
                  <View style={styles.numberField}>
                    <Text style={styles.label}>Actual reps</Text>
                    <PositiveIntegerInput
                      onChangeValue={(value) => updateActualSetGroup(index, groupIndex, { ...group, reps: value })}
                      style={styles.input}
                      value={group.reps}
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
            placeholderTextColor={colors.textFaint}
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
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    gap: 12,
    padding: 18,
  },
  exerciseTitle: {
    color: colors.navy,
    fontSize: 19,
    fontWeight: '900',
  },
  exerciseNameInput: {
    fontSize: 19,
    fontWeight: '900',
  },
  field: {
    gap: 6,
  },
  groupTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 2,
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  label: {
    color: colors.textMuted,
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
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    color: colors.navy,
    fontSize: 30,
    fontWeight: '900',
  },
});
