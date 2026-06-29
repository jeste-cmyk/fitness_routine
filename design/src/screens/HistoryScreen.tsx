import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../components/EmptyState';
import { confirm } from '../lib/confirm';
import { useAuth } from '../contexts/AuthContext';
import { formatSetGroups, normalizeSetGroups } from '../lib/exercisePlan';
import { deleteWorkoutSession, fetchWorkoutHistory } from '../lib/routines';
import { WorkoutHistorySession } from '../lib/types';

type HistoryView = 'daily' | 'routine';

type DailyGroup = {
  date: string;
  sessions: WorkoutHistorySession[];
};

type RoutineGroup = {
  key: string;
  name: string;
  sessions: WorkoutHistorySession[];
};

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    year: 'numeric',
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatCompletedTime(value: string | null) {
  if (!value) {
    return 'Completed';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function getRoutineName(session: WorkoutHistorySession) {
  return session.routine_name ?? session.title ?? 'Deleted routine';
}

function groupByDay(sessions: WorkoutHistorySession[]): DailyGroup[] {
  const groups = new Map<string, WorkoutHistorySession[]>();

  sessions.forEach((session) => {
    const current = groups.get(session.scheduled_date) ?? [];
    groups.set(session.scheduled_date, [...current, session]);
  });

  return Array.from(groups.entries()).map(([date, daySessions]) => ({
    date,
    sessions: daySessions,
  }));
}

function groupByRoutine(sessions: WorkoutHistorySession[]): RoutineGroup[] {
  const groups = new Map<string, RoutineGroup>();

  sessions.forEach((session) => {
    const key = session.routine_id ?? session.id;
    const current = groups.get(key);

    if (current) {
      groups.set(key, { ...current, sessions: [...current.sessions, session] });
      return;
    }

    groups.set(key, {
      key,
      name: getRoutineName(session),
      sessions: [session],
    });
  });

  return Array.from(groups.values());
}

function SessionCard({
  deletingSessionId,
  onDeleteSession,
  session,
  showRoutineName,
}: {
  deletingSessionId: string | null;
  onDeleteSession: (session: WorkoutHistorySession) => void;
  session: WorkoutHistorySession;
  showRoutineName: boolean;
}) {
  const deletingSession = deletingSessionId === session.id;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{showRoutineName ? getRoutineName(session) : formatDate(session.scheduled_date)}</Text>
        <View style={styles.cardActions}>
          <Text style={styles.timePill}>{formatCompletedTime(session.completed_at)}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={deletingSession}
            onPress={() => onDeleteSession(session)}
            style={({ pressed }) => [
              styles.deleteSessionButton,
              (pressed || deletingSession) && styles.deleteButtonPressed,
            ]}
          >
            <Text style={styles.deleteSessionLabel}>{deletingSession ? 'Deleting' : 'Delete'}</Text>
          </Pressable>
        </View>
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
    </View>
  );
}

export function HistoryScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<WorkoutHistorySession[]>([]);
  const [view, setView] = useState<HistoryView>('daily');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const dailyGroups = useMemo(() => groupByDay(history), [history]);
  const routineGroups = useMemo(() => groupByRoutine(history), [history]);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setHistory(await fetchWorkoutHistory(user.id));
    } catch (error) {
      Alert.alert('Could not load history', error instanceof Error ? error.message : 'Please try again.');
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

  function removeSessionFromHistory(sessionId: string) {
    setHistory((current) => current.filter((session) => session.id !== sessionId));
  }

  async function confirmDeleteSession(session: WorkoutHistorySession) {
    const sessionName = getRoutineName(session);
    const sessionDate = formatDate(session.scheduled_date);

    const confirmed = await confirm({
      title: 'Delete completed routine?',
      message: `This removes "${sessionName}" from your workout history for ${sessionDate}.`,
      confirmLabel: 'Delete',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      setDeletingSessionId(session.id);
      await deleteWorkoutSession(session.id);
      removeSessionFromHistory(session.id);
    } catch (error) {
      Alert.alert('Could not delete completed routine', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDeletingSessionId(null);
    }
  }

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
        <View>
          <Text style={styles.eyebrow}>Completed workouts</Text>
          <Text style={styles.title}>History</Text>
        </View>
        <View style={styles.segmentGroup}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setView('daily')}
            style={[styles.segmentButton, view === 'daily' && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentLabel, view === 'daily' && styles.segmentLabelActive]}>Daily</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setView('routine')}
            style={[styles.segmentButton, view === 'routine' && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentLabel, view === 'routine' && styles.segmentLabelActive]}>Routine</Text>
          </Pressable>
        </View>
      </View>

      {loading ? <ActivityIndicator color="#0f766e" size="large" /> : null}

      {!loading && history.length === 0 ? (
        <EmptyState title="No workout history yet" message="Complete a routine and the details will appear here." />
      ) : null}

      {!loading && view === 'daily'
        ? dailyGroups.map((group) => (
            <View key={group.date} style={styles.section}>
              <View>
                <Text style={styles.sectionTitle}>{formatDate(group.date)}</Text>
              </View>
              {group.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  deletingSessionId={deletingSessionId}
                  onDeleteSession={confirmDeleteSession}
                  session={session}
                  showRoutineName
                />
              ))}
            </View>
          ))
        : null}

      {!loading && view === 'routine'
        ? routineGroups.map((group) => (
            <View key={group.key} style={styles.section}>
              <View>
                <Text style={styles.sectionTitle}>{group.name}</Text>
                <Text style={styles.sectionMeta}>
                  {group.sessions.length} {group.sessions.length === 1 ? 'execution' : 'executions'}
                </Text>
              </View>
              {group.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  deletingSessionId={deletingSessionId}
                  onDeleteSession={confirmDeleteSession}
                  session={session}
                  showRoutineName={false}
                />
              ))}
            </View>
          ))
        : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  cardActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  container: {
    backgroundColor: '#f8fafc',
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 32,
  },
  exercise: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  exerciseList: {
    gap: 6,
  },
  eyebrow: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  header: {
    gap: 14,
  },
  logRow: {
    gap: 4,
  },
  notes: {
    color: '#475569',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  planned: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  timePill: {
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    color: '#075985',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteSessionButton: {
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 10,
  },
  deleteSessionLabel: {
    color: '#be123c',
    fontSize: 13,
    fontWeight: '800',
  },
  deleteButtonPressed: {
    opacity: 0.72,
  },
  section: {
    gap: 12,
  },
  sectionMeta: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  segmentButtonActive: {
    backgroundColor: '#0f766e',
  },
  segmentGroup: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    flexDirection: 'row',
    padding: 3,
  },
  segmentLabel: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
  segmentLabelActive: {
    color: '#ffffff',
  },
  title: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '900',
  },
});
