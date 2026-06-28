jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Alert: { alert: jest.fn() },
}));

import { Alert, Platform } from 'react-native';
import { notify } from '../notify';

const platform = Platform as unknown as { OS: string };
const alertMock = Alert.alert as jest.Mock;

describe('notify', () => {
  const originalWindow = (global as { window?: unknown }).window;

  afterEach(() => {
    (global as { window?: unknown }).window = originalWindow;
    alertMock.mockReset();
  });

  it('uses window.alert with title and message on web', () => {
    platform.OS = 'web';
    const alertFn = jest.fn();
    (global as { window?: unknown }).window = { alert: alertFn };

    notify('Heads up', 'Something happened');

    expect(alertFn).toHaveBeenCalledWith('Heads up\n\nSomething happened');
  });

  it('uses window.alert with only the title when no message is given', () => {
    platform.OS = 'web';
    const alertFn = jest.fn();
    (global as { window?: unknown }).window = { alert: alertFn };

    notify('Heads up');

    expect(alertFn).toHaveBeenCalledWith('Heads up');
  });

  it('does not throw on web when window is unavailable', () => {
    platform.OS = 'web';
    (global as { window?: unknown }).window = undefined;
    expect(() => notify('Heads up')).not.toThrow();
  });

  it('uses Alert.alert on native', () => {
    platform.OS = 'ios';
    notify('Heads up', 'Something happened');
    expect(alertMock).toHaveBeenCalledWith('Heads up', 'Something happened');
  });
});
