module.exports = {
  EventType: {PRESS: 1},
  default: {
    onForegroundEvent: jest.fn(() => jest.fn()),
  },
  onForegroundEvent: jest.fn(() => jest.fn()),
};
