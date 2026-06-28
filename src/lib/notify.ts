import { Alert, Platform } from 'react-native';

/**
 * Cross-platform notification dialog.
 *
 * `Alert.alert` is a no-op on react-native-web, so messages never appear in the
 * browser. This falls back to the native `window.alert` on web and uses
 * `Alert.alert` everywhere else.
 */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;

    if (typeof window !== 'undefined') {
      window.alert(text);
    }

    return;
  }

  Alert.alert(title, message);
}
