module.exports = {
  DocumentDirectoryPath: '/tmp',
  DownloadDirectoryPath: '/tmp',
  writeFile: jest.fn(async () => undefined),
  readFile: jest.fn(async () => ''),
  exists: jest.fn(async () => false),
  unlink: jest.fn(async () => undefined),
};
