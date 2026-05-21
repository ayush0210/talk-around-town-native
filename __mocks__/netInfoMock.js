module.exports = {
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(async () => ({isConnected: true, isInternetReachable: true})),
};
