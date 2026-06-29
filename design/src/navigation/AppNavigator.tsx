import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { AuthScreen } from '../screens/AuthScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { QuickLogScreen } from '../screens/QuickLogScreen';
import { RoutineEditorScreen } from '../screens/RoutineEditorScreen';
import { RoutinesScreen } from '../screens/RoutinesScreen';
import { SupabaseSetupScreen } from '../screens/SupabaseSetupScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0f766e',
        tabBarInactiveTintColor: '#64748b',
        tabBarActiveBackgroundColor: '#ccfbf1',
        tabBarStyle: [styles.tabBar, { height: 70 + insets.bottom, paddingBottom: 10 + insets.bottom }],
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Today: 'today-outline',
            Routines: 'barbell-outline',
            History: 'time-outline',
            Profile: 'person-circle-outline',
          } as const;

          return <Ionicons name={icons[route.name]} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Routines" component={RoutinesScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { loading, session } = useAuth();

  if (!isSupabaseConfigured) {
    return <SupabaseSetupScreen />;
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#0f766e" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? (
        <Stack.Navigator>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="RoutineEditor" component={RoutineEditorScreen} options={{ title: 'Routine' }} />
          <Stack.Screen name="Workout" component={WorkoutScreen} options={{ title: 'Workout' }} />
          <Stack.Screen name="QuickLog" component={QuickLogScreen} options={{ title: 'Quick log' }} />
        </Stack.Navigator>
      ) : (
        <AuthScreen />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center',
  },
  tabBar: {
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  tabBarItem: {
    borderRadius: 14,
    marginHorizontal: 8,
  },
  tabBarLabel: {
    fontWeight: '700',
  },
});
