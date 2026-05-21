const messaging = () => ({
  getToken: jest.fn(async () => 'test-fcm-token'),
  hasPermission: jest.fn(async () => messaging.AuthorizationStatus.AUTHORIZED),
  requestPermission: jest.fn(async () => messaging.AuthorizationStatus.AUTHORIZED),
  registerDeviceForRemoteMessages: jest.fn(async () => undefined),
  onTokenRefresh: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(async () => null),
  isAutoInitEnabled: true,
});

messaging.AuthorizationStatus = {
  AUTHORIZED: 1,
  PROVISIONAL: 2,
  DENIED: 0,
};

module.exports = messaging;
module.exports.default = messaging;
