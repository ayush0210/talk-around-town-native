module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^@notifee/react-native$': '<rootDir>/__mocks__/notifeeMock.js',
    '^@expo/vector-icons$': '<rootDir>/__mocks__/expoVectorIconsMock.js',
    '^@react-native-community/geolocation$':
      '<rootDir>/__mocks__/geolocationMock.js',
    '^@react-native-community/netinfo$': '<rootDir>/__mocks__/netInfoMock.js',
    '^@react-native-community/datetimepicker$':
      '<rootDir>/__mocks__/dateTimePickerMock.js',
    '^@react-native-firebase/messaging$': '<rootDir>/__mocks__/messagingMock.js',
    '^@react-native-voice/voice$': '<rootDir>/__mocks__/voiceMock.js',
    '^react-native-background-fetch$':
      '<rootDir>/__mocks__/backgroundFetchMock.js',
    '^react-native-audio-recorder-player$':
      '<rootDir>/__mocks__/audioRecorderPlayerMock.js',
    '^react-native-chart-kit$': '<rootDir>/__mocks__/chartKitMock.js',
    '^react-native-get-location$': '<rootDir>/__mocks__/emptyMock.js',
    '^react-native-google-places-autocomplete$':
      '<rootDir>/__mocks__/googlePlacesMock.js',
    '^react-native-linear-gradient$':
      '<rootDir>/__mocks__/linearGradientMock.js',
    '^react-native-loading-spinner-overlay$':
      '<rootDir>/__mocks__/spinnerMock.js',
    '^react-native-maps$': '<rootDir>/__mocks__/mapViewMock.js',
    '^react-native-push-notification$':
      '<rootDir>/__mocks__/pushNotificationMock.js',
    '^react-native-sound$': '<rootDir>/__mocks__/soundMock.js',
    '^react-native-fs$': '<rootDir>/__mocks__/fsMock.js',
    '^react-native-vector-icons/(.*)$': '<rootDir>/__mocks__/iconMock.js',
    '^uuid$': '<rootDir>/__mocks__/uuidMock.js',
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
