import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppButton } from '../components/AppButton';
import { useAuth } from '../contexts/AuthContext';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    setMessage(null);

    if (!normalizedEmail || !password) {
      Alert.alert('Missing details', 'Enter an email and password to continue.');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    if (mode === 'signUp' && password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters for your password.');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'signIn') {
        await signIn(normalizedEmail, password);
      } else {
        const result = await signUp(normalizedEmail, password);

        if (result.session) {
          setMessage('Account created. You are signed in.');
          return;
        }

        setMode('signIn');
        setPassword('');
        setMessage('Account created. Confirm your email before signing in.');
        Alert.alert('Confirm your email', 'Supabase created the account, but email confirmation is required before sign in.');
      }
    } catch (error) {
      const errorMessage = getAuthErrorMessage(error, mode);
      setMessage(errorMessage);
      Alert.alert('Authentication failed', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.panel}>
        <Text style={styles.title}>Fitness Routine</Text>
        <Text style={styles.subtitle}>Plan today. Track what you actually did.</Text>

        <View style={styles.form}>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={email}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <AppButton
            label={mode === 'signIn' ? 'Sign in' : 'Create account'}
            loading={loading}
            onPress={submit}
          />
          <AppButton
            label={mode === 'signIn' ? 'Need an account?' : 'Already have an account?'}
            onPress={() => {
              setMessage(null);
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            }}
            variant="ghost"
          />
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function getAuthErrorMessage(error: unknown, mode: 'signIn' | 'signUp') {
  const authError = error as { code?: string; message?: string; status?: number };

  if (authError.code === 'over_email_send_rate_limit' || authError.status === 429) {
    return 'Supabase is rate limiting confirmation emails. Wait a few minutes, then try creating the account again.';
  }

  if (authError.code === 'user_already_exists') {
    return 'An account already exists for this email. Sign in instead.';
  }

  if (authError.code === 'invalid_credentials') {
    return 'The email or password is incorrect.';
  }

  if (authError.message) {
    return authError.message;
  }

  return mode === 'signUp' ? 'Could not create the account. Please try again.' : 'Please try again.';
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  form: {
    gap: 12,
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
  message: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  panel: {
    gap: 28,
  },
  subtitle: {
    color: '#475569',
    fontSize: 17,
    lineHeight: 24,
  },
  title: {
    color: '#0f172a',
    fontSize: 36,
    fontWeight: '900',
  },
});
