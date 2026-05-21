/* eslint-env jest */

const ReactNative = require('react-native');

Object.defineProperty(ReactNative, 'AppState', {
  configurable: true,
  value: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
    removeEventListener: jest.fn(),
  },
});

Object.defineProperty(ReactNative, 'BackHandler', {
  configurable: true,
  value: {
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
    removeEventListener: jest.fn(),
    exitApp: jest.fn(),
  },
});

Object.defineProperty(ReactNative, 'Linking', {
  configurable: true,
  value: {
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
    getInitialURL: jest.fn(async () => null),
    openURL: jest.fn(async () => undefined),
    openSettings: jest.fn(async () => undefined),
  },
});

ReactNative.PermissionsAndroid.request = jest.fn(
  async () => ReactNative.PermissionsAndroid.RESULTS.GRANTED,
);

ReactNative.Alert.alert = jest.fn();
