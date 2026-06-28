jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Alert: { alert: jest.fn() },
}));

import { Alert, Platform } from 'react-native';
import { confirm, notify } from '../confirm';

const platform = Platform as unknown as { OS: string };
const alertMock = Alert.alert as jest.Mock;

type AlertButton = { text: string; style?: string; onPress?: () => void };

describe('confirm — web', () => {
  const originalWindow = (global as { window?: unknown }).window;

  beforeEach(() => {
    platform.OS = 'web';
  });

  afterEach(() => {
    (global as { window?: unknown }).window = originalWindow;
  });

  it('resolves true when window.confirm returns true', async () => {
    (global as { window?: unknown }).window = { confirm: jest.fn(() => true) };
    await expect(confirm({ title: 'Delete routine?' })).resolves.toBe(true);
  });

  it('resolves false when window.confirm returns false', async () => {
    (global as { window?: unknown }).window = { confirm: jest.fn(() => false) };
    await expect(confirm({ title: 'Delete routine?' })).resolves.toBe(false);
  });

  it('combines title and message into the prompt text', async () => {
    const confirmFn = jest.fn(() => true);
    (global as { window?: unknown }).window = { confirm: confirmFn };

    await confirm({ title: 'Delete routine?', message: 'This cannot be undone' });

    expect(confirmFn).toHaveBeenCalledWith('Delete routine?\n\nThis cannot be undone');
  });

  it('resolves false when window is unavailable', async () => {
    (global as { window?: unknown }).window = undefined;
    await expect(confirm({ title: 'Delete routine?' })).resolves.toBe(false);
  });
});

describe('confirm — native', () => {
  beforeEach(() => {
    platform.OS = 'ios';
    alertMock.mockReset();
  });

  it('resolves true when the confirm button is pressed', async () => {
    alertMock.mockImplementation((_title, _message, buttons: AlertButton[]) => {
      buttons.find((b) => b.style !== 'cancel')?.onPress?.();
    });

    await expect(confirm({ title: 'Delete routine?', confirmLabel: 'Delete' })).resolves.toBe(true);
  });

  it('resolves false when the cancel button is pressed', async () => {
    alertMock.mockImplementation((_title, _message, buttons: AlertButton[]) => {
      buttons.find((b) => b.style === 'cancel')?.onPress?.();
    });

    await expect(confirm({ title: 'Delete routine?' })).resolves.toBe(false);
  });

  it('passes custom labels and a destructive style to Alert', async () => {
    let captured: AlertButton[] = [];
    alertMock.mockImplementation((_title, _message, buttons: AlertButton[]) => {
      captured = buttons;
      buttons[0].onPress?.();
    });

    await confirm({
      title: 'Delete routine?',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      destructive: true,
    });

    const cancel = captured.find((b) => b.style === 'cancel');
    const confirmBtn = captured.find((b) => b.style === 'destructive');
    expect(cancel?.text).toBe('Keep');
    expect(confirmBtn?.text).toBe('Delete');
  });
});

describe('notify (confirm.ts)', () => {
  const originalWindow = (global as { window?: unknown }).window;

  afterEach(() => {
    (global as { window?: unknown }).window = originalWindow;
    alertMock.mockReset();
  });

  it('uses window.alert on web', () => {
    platform.OS = 'web';
    const alertFn = jest.fn();
    (global as { window?: unknown }).window = { alert: alertFn };

    notify('Saved', 'Routine updated');

    expect(alertFn).toHaveBeenCalledWith('Saved\n\nRoutine updated');
  });

  it('uses Alert.alert on native', () => {
    platform.OS = 'ios';
    notify('Saved', 'Routine updated');
    expect(alertMock).toHaveBeenCalledWith('Saved', 'Routine updated');
  });
});
