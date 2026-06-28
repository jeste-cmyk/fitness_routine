import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { deleteRoutine, fetchRoutineById, saveRoutineDetails } from '../lib/routines';
import { EditableExercise, WEEKDAYS, Weekday } from '../lib/types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoutineEditor'>;

const blankExercise = (): EditableExercise => ({
  name: '',
  reps: 1,
  sets: 1,
});

function parsePositiveInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

export function RoutineEditorScreen({ navigation, route }: Props) {
  const routineId = route.params?.routineId;
  const isEditing = Boolean(routineId);
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [exercises, setExercises] = useState<EditableExercise[]>([blankExercise()]);
  const [loading, setLoading] = useState(Boolean(routineId));
  const [saving, setSaving] = useState(false);

  const title = useMemo(() => (isEditing ? 'Edit routine' : 'New routine'), [isEditing]);

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const load = useCallback(async () => {
    if (!user || !routineId) {
      setLoading(false);
      return;
    }

    try {
      const routine = await fetchRoutineById(user.id, routineId);
      setName(routine.name);
      setNotes(routine.notes ?? '');
      setWeekdays(routine.schedule.filter((item) => item.is_active).map((item) => item.weekday));
      setExercises(
        routine.exercises.length > 0
          ? routine.exercises.map((exercise) => ({
              id: exercise.id,
              name: exercise.name,
              reps: exercise.reps,
              sets: exercise.sets,
            }))
          : [blankExercise()],
      );
    } catch (error) {
      Alert.alert('Could not load routine', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [routineId, user]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleWeekday(weekday: Weekday) {
    setWeekdays((current) =>
      current.includes(weekday) ? current.filter((item) => item !== weekday) : [...current, weekday].sort(),
    );
  }

  function updateExercise(index: number, nextExercise: EditableExercise) {
    setExercises((current) => current.map((exercise, itemIndex) => (itemIndex === index ? nextExercise : exercise)));
  }

  function moveExercise(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= exercises.length) {
      return;
    }

    setExercises((current) => {
      const next = [...current];
      const item = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = item;
      return next;
    });
  }

  async function save() {
    if (!user) {
      return;
    }

    try {
      setSaving(true);
      await saveRoutineDetails({
        routineId,
        userId: user.id,
        name,
        notes,
        weekdays,
        exercises,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not save routine', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function removeRoutine() {
    if (!routineId) {
      return;
    }

    Alert.alert('Delete routine?', 'This removes the routine and its schedule. Workout history stays saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoutine(routineId);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Could not delete routine', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen>
        <Text style={styles.title}>Loading routine...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.sectionTitle}>Details</Text>
      <TextInput
        onChangeText={setName}
        placeholder="Routine name"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={name}
      />
      <TextInput
        multiline
        onChangeText={setNotes}
        placeholder="Notes"
        placeholderTextColor="#94a3b8"
        style={[styles.input, styles.notesInput]}
        value={notes}
      />

      <Text style={styles.sectionTitle}>Schedule</Text>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((weekday) => {
          const selected = weekdays.includes(weekday.value);
          return (
            <AppButton
              key={weekday.value}
              label={weekday.short}
              onPress={() => toggleWeekday(weekday.value)}
              style={styles.dayButton}
              variant={selected ? 'primary' : 'secondary'}
            />
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Exercises</Text>
        <AppButton label="Add" onPress={() => setExercises((current) => [...current, blankExercise()])} variant="secondary" />
      </View>

      {exercises.map((exercise, index) => (
        <View key={`${exercise.id ?? 'new'}-${index}`} style={styles.exerciseCard}>
          <Text style={styles.exerciseTitle}>Exercise {index + 1}</Text>
          <TextInput
            onChangeText={(value) => updateExercise(index, { ...exercise, name: value })}
            placeholder="Exercise name"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={exercise.name}
          />
          <View style={styles.numberRow}>
            <View style={styles.numberField}>
              <Text style={styles.label}>Reps</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => updateExercise(index, { ...exercise, reps: parsePositiveInt(value) })}
                style={styles.input}
                value={String(exercise.reps)}
              />
            </View>
            <View style={styles.numberField}>
              <Text style={styles.label}>Sets</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => updateExercise(index, { ...exercise, sets: parsePositiveInt(value) })}
                style={styles.input}
                value={String(exercise.sets)}
              />
            </View>
          </View>
          <View style={styles.actionRow}>
            <AppButton label="Up" onPress={() => moveExercise(index, -1)} variant="secondary" style={styles.smallButton} />
            <AppButton label="Down" onPress={() => moveExercise(index, 1)} variant="secondary" style={styles.smallButton} />
            <AppButton
              label="Remove"
              onPress={() => setExercises((current) => current.filter((_item, itemIndex) => itemIndex !== index))}
              variant="danger"
              style={styles.removeButton}
            />
          </View>
        </View>
      ))}

      <AppButton label="Save routine" loading={saving} onPress={save} />
      {routineId ? <AppButton label="Delete routine" onPress={removeRoutine} variant="danger" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    minWidth: 64,
  },
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  exerciseTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
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
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  numberField: {
    flex: 1,
  },
  numberRow: {
    flexDirection: 'row',
    gap: 12,
  },
  removeButton: {
    flexGrow: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  smallButton: {
    minWidth: 72,
  },
  title: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
