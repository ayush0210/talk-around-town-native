module.exports = {
  getCurrentPosition: jest.fn((success, _error) =>
    success?.({coords: {latitude: 0, longitude: 0}}),
  ),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
};
