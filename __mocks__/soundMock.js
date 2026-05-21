function SoundMock(_url, _basePath, callback) {
  callback?.();
}

SoundMock.prototype.play = jest.fn(callback => callback?.(true));
SoundMock.prototype.release = jest.fn();
SoundMock.prototype.stop = jest.fn(callback => callback?.());
SoundMock.prototype.setVolume = jest.fn();
SoundMock.setCategory = jest.fn();

module.exports = SoundMock;
module.exports.default = SoundMock;
