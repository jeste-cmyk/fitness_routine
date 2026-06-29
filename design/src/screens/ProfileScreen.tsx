import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';

export function ProfileScreen() {
  const { signOut, user } = useAuth();

  async function logout() {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Could not log out', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <Screen>
      <View>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <AppButton label="Log out" onPress={logout} variant="danger" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  email: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  label: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '900',
  },
});
