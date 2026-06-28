import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * Cross-platform confirmation dialog.
 *
 * `Alert.alert` with a buttons array is a no-op on react-native-web, so the
 * confirm/cancel callbacks never fire in the browser. This falls back to the
 * native `window.confirm` on web and uses `Alert.alert` everywhere else.
 *
 * Resolves to `true` when the user confirms, `false` otherwise.
 */
export function confirm({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(text) : false);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/**
 * Cross-platform single-button alert.
 *
 * `Alert.alert` is a no-op on react-native-web, so messages (including error
 * reports) never reach the user in the browser. This falls back to the native
 * `window.alert` on web and uses `Alert.alert` everywhere else.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }

  Alert.alert(title, message);
}
