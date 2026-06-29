import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../components/AppButton';
import { PositiveIntegerInput } from '../components/PositiveIntegerInput';
import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { getLocalDateString } from '../lib/date';
import { notify } from '../lib/notify';
import { logAdHocWorkout } from '../lib/routines';
import { WorkoutExerciseLogInput } from '../lib/types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'QuickLog'>;

type DraftExercise = {
  key: string;
  name: string;
  sets: number;
  reps: number;
};

function toLog(exercise: DraftExercise, notes: string): WorkoutExerciseLogInput {
  return {
    routineExerciseId: null,
    name: exercise.name.trim(),
    plannedReps: exercise.reps,
    plannedSets: exercise.sets,
    plannedSetGroups: [{ reps: exercise.reps, sets: exercise.sets }],
    actualReps: exercise.reps,
    actualSets: exercise.sets,
    actualSetGroups: [{ reps: exercise.reps, sets: exercise.sets }],
    notes,
  };
}

export function QuickLogScreen({ navigation, route }: Props) {
  const { mode } = route.params;
  const isFailure = mode === 'failure';
  const { user } = useAuth();
  const nextKey = useRef(0);

  const makeExercise = (): DraftExercise => {
    nextKey.current += 1;
    return { key: `exercise-${nextKey.current}`, name: '', sets: isFailure ? 1 : 3, reps: isFailure ? 8 : 10 };
  };

  const [title, setTitle] = useState('');
  const [failureNotes, setFailureNotes] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>(() => [makeExercise()]);
  const [saving, setSaving] = useState(false);

  const screenTitle = isFailure ? 'Exercise to failure' : 'Temporal routine';

  useEffect(() => {
    navigation.setOptions({ title: screenTitle });
  }, [navigation, screenTitle]);

  function updateExercise(index: number, next: DraftExercise) {
    setExercises((current) => current.map((exercise, itemIndex) => (itemIndex === index ? next : exercise)));
  }

  async function save() {
    if (!user || saving) {
      return;
    }

    const named = exercises.filter((exercise) => exercise.name.trim());

    if (named.length === 0) {
      notify('Add an exercise', 'Enter at least one exercise name before logging.');
      return;
    }

    const resolvedTitle = isFailure
      ? named[0].name.trim()
      : title.trim() || 'Temporal routine';

    const logs = isFailure
      ? named.slice(0, 1).map((exercise) => {
          const extra = failureNotes.trim();
          return toLog(exercise, extra ? `To failure - ${extra}` : 'To failure');
        })
      : named.map((exercise) => toLog(exercise, ''));

    try {
      setSaving(true);
      await logAdHocWorkout({
        userId: user.id,
        title: resolvedTitle,
        scheduledDate: getLocalDateString(),
        logs,
      });
      navigation.goBack();
    } catch (error) {
      notify('Could not log', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View>
        <Text style={styles.eyebrow}>{isFailure ? 'Quick log' : 'Just for today'}</Text>
        <Text style={styles.title}>{screenTitle}</Text>
        <Text style={styles.subtitle}>
          {isFailure
            ? 'Record a single exercise taken to failure. It is saved straight to your history for today.'
            : 'Build a one-off routine for today. It is logged as completed and will not appear in your weekly schedule.'}
        </Text>
      </View>

      {isFailure ? null : (
        <View style={styles.field}>
          <Text style={styles.label}>Routine name</Text>
          <TextInput
            onChangeText={setTitle}
            placeholder="Temporal routine"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={title}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>{isFailure ? 'Exercise' : 'Exercises'}</Text>

      {(isFailure ? exercises.slice(0, 1) : exercises).map((exercise, index) => (
        <View key={exercise.key} style={styles.card}>
          {isFailure ? null : <Text style={styles.cardTitle}>Exercise {index + 1}</Text>}
          <TextInput
            onChangeText={(value) => updateExercise(index, { ...exercise, name: value })}
            placeholder="Exercise name"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={exercise.name}
          />
          <View style={styles.numberRow}>
            <View style={styles.numberField}>
              <Text style={styles.label}>Sets</Text>
              <PositiveIntegerInput
                onChangeValue={(value) => updateExercise(index, { ...exercise, sets: value })}
                style={[styles.input, styles.numberInput]}
                value={exercise.sets}
              />
            </View>
            <View style={styles.numberField}>
              <Text style={styles.label}>{isFailure ? 'Reps reached' : 'Reps'}</Text>
              <PositiveIntegerInput
                onChangeValue={(value) => updateExercise(index, { ...exercise, reps: value })}
                style={[styles.input, styles.numberInput]}
                value={exercise.reps}
              />
            </View>
          </View>
          {isFailure || exercises.length === 1 ? null : (
            <AppButton
              label="Remove"
              onPress={() => setExercises((current) => current.filter((_item, itemIndex) => itemIndex !== index))}
              variant="danger"
            />
          )}
        </View>
      ))}

      {isFailure ? (
        <View style={styles.field}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            multiline
            onChangeText={setFailureNotes}
            placeholder="How it felt, weight used, etc."
            placeholderTextColor="#94a3b8"
            style={[styles.input, styles.notesInput]}
            value={failureNotes}
          />
        </View>
      ) : (
        <AppButton
          label="Add exercise"
          onPress={() => setExercises((current) => [...current, makeExercise()])}
          variant="secondary"
        />
      )}

      <AppButton label={isFailure ? 'Log exercise' : 'Log workout'} loading={saving} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  eyebrow: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  field: {
    gap: 6,
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
  numberInput: {
    minHeight: 44,
  },
  numberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  title: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '900',
  },
});
