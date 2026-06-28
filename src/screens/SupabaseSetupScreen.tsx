import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export function SupabaseSetupScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Connect Supabase</Text>
      <Text style={styles.body}>
        Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment, then restart Expo.
      </Text>
      <Text style={styles.code}>cp .env.example .env</Text>
      <Text style={styles.body}>Run the SQL in supabase/schema.sql in your Supabase project before signing in.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  code: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    color: '#0f172a',
    fontFamily: 'monospace',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  container: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
  },
});
