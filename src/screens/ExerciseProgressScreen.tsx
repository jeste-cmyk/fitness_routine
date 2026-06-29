import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, DimensionValue, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { colors, radius, shadows } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { formatSetGroups } from '../lib/exercisePlan';
import { fetchExerciseProgress } from '../lib/routines';
import { ExerciseProgressSummary, ExerciseProgressTrend } from '../lib/types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseProgress'>;

function normalizeExerciseName(name: string) {
  return name.trim().toLowerCase();
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatShortDate(dateString: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dateString}T00:00:00`));
}

function getTrendLabel(trend: ExerciseProgressTrend) {
  if (trend === 'up') {
    return 'Improving';
  }

  if (trend === 'down') {
    return 'Lower';
  }

  return 'Stable';
}

function getTrendStyle(trend: ExerciseProgressTrend) {
  if (trend === 'up') {
    return styles.trendUp;
  }

  if (trend === 'down') {
    return styles.trendDown;
  }

  return styles.trendFlat;
}

export function ExerciseProgressScreen({ route }: Props) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ExerciseProgressSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const exerciseKey = normalizeExerciseName(route.params.exerciseName);

  const exercise = useMemo(
    () => progress.find((item) => normalizeExerciseName(item.exerciseName) === exerciseKey) ?? null,
    [exerciseKey, progress],
  );

  const chartEntries = useMemo(() => {
    if (!exercise) {
      return [];
    }

    return exercise.entries.slice(0, 8).reverse();
  }, [exercise]);

  const chartMax = Math.max(...chartEntries.map((entry) => entry.totalReps), 1);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setProgress(await fetchExerciseProgress(user.id));
    } catch (error) {
      Alert.alert('Could not load exercise progress', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (!exercise) {
    return (
      <Screen>
        <EmptyState
          title="No exercise history"
          message="Complete this exercise again and its progress will appear here."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View>
        <Text style={styles.eyebrow}>Exercise progress</Text>
        <Text style={styles.title}>{exercise.exerciseName}</Text>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Last volume</Text>
          <Text style={styles.summaryValue}>{exercise.lastTotalReps}</Text>
          <Text style={styles.summaryMeta}>total reps</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Best volume</Text>
          <Text style={styles.summaryValue}>{exercise.bestTotalReps}</Text>
          <Text style={styles.summaryMeta}>total reps</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Records</Text>
          <Text style={styles.summaryValue}>{exercise.entryCount}</Text>
          <Text style={styles.summaryMeta}>{getTrendLabel(exercise.trend)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Volume trend</Text>
          <Text style={[styles.trendPill, getTrendStyle(exercise.trend)]}>{getTrendLabel(exercise.trend)}</Text>
        </View>

        <View style={styles.chart}>
          {chartEntries.map((entry) => {
            const width = `${Math.max((entry.totalReps / chartMax) * 100, 4)}%` as DimensionValue;

            return (
              <View key={entry.id} style={styles.chartRow}>
                <Text style={styles.chartDate}>{formatShortDate(entry.scheduledDate)}</Text>
                <View style={styles.chartTrack}>
                  <View style={[styles.chartBar, { width }]} />
                </View>
                <Text style={styles.chartValue}>{entry.totalReps}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Entries</Text>
        {exercise.entries.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <View style={styles.entryHeader}>
              <View style={styles.entryTitleGroup}>
                <Text style={styles.entryDate}>{formatDate(entry.scheduledDate)}</Text>
                <Text style={styles.entryWorkout}>{entry.workoutName}</Text>
              </View>
              <View style={styles.volumePill}>
                <Text style={styles.volumeValue}>{entry.totalReps}</Text>
                <Text style={styles.volumeLabel}>reps</Text>
              </View>
            </View>
            <Text style={styles.entryDetails}>
              {formatSetGroups(entry.actualSetGroups)} - {entry.totalSets} {entry.totalSets === 1 ? 'set' : 'sets'}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    gap: 12,
    padding: 18,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  chart: {
    gap: 10,
  },
  chartBar: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 12,
  },
  chartDate: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    width: 54,
  },
  chartRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  chartTrack: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    flex: 1,
    height: 12,
    overflow: 'hidden',
  },
  chartValue: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    width: 42,
  },
  entryDate: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '900',
  },
  entryDetails: {
    color: colors.body,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  entryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  entryTitleGroup: {
    flex: 1,
    gap: 3,
  },
  entryWorkout: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '900',
  },
  summaryCard: {
    ...shadows.soft,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flex: 1,
    minWidth: 120,
    padding: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryValue: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  title: {
    color: colors.navy,
    fontSize: 30,
    fontWeight: '900',
  },
  trendDown: {
    backgroundColor: colors.dangerBg,
    color: colors.dangerText,
  },
  trendFlat: {
    backgroundColor: colors.border,
    color: colors.textMuted,
  },
  trendPill: {
    borderRadius: radius.pill,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  trendUp: {
    backgroundColor: colors.greenSoftBg,
    color: colors.greenText,
  },
  volumeLabel: {
    color: colors.chipBlueText,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  volumePill: {
    alignItems: 'center',
    backgroundColor: colors.chipBlueBg,
    borderRadius: radius.md,
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  volumeValue: {
    color: colors.chipBlueText,
    fontSize: 18,
    fontWeight: '900',
  },
});
