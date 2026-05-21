function AudioRecorderPlayerMock() {}

AudioRecorderPlayerMock.prototype.startRecorder = jest.fn(async () => 'test-audio-path');
AudioRecorderPlayerMock.prototype.stopRecorder = jest.fn(async () => 'test-audio-path');
AudioRecorderPlayerMock.prototype.startPlayer = jest.fn(async () => 'test-audio-path');
AudioRecorderPlayerMock.prototype.stopPlayer = jest.fn(async () => undefined);
AudioRecorderPlayerMock.prototype.addRecordBackListener = jest.fn();
AudioRecorderPlayerMock.prototype.removeRecordBackListener = jest.fn();
AudioRecorderPlayerMock.prototype.addPlayBackListener = jest.fn();
AudioRecorderPlayerMock.prototype.removePlayBackListener = jest.fn();

module.exports = AudioRecorderPlayerMock;
module.exports.default = AudioRecorderPlayerMock;
module.exports.AudioEncoderAndroidType = {};
module.exports.AudioSourceAndroidType = {};
module.exports.OutputFormatAndroidType = {};
