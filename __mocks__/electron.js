// Mock for electron module used in Vitest tests
const app = {
  getPath: () => '/tmp/test-app-data',
  getName: () => 'test-app',
  getVersion: () => '0.0.0',
};

const ipcMain = {
  on: () => {},
  handle: () => {},
  removeHandler: () => {},
};

const ipcRenderer = {
  on: () => {},
  send: () => {},
  invoke: () => Promise.resolve(),
};

const shell = {
  openExternal: () => Promise.resolve(),
  openPath: () => Promise.resolve(),
};

const dialog = {
  showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
  showSaveDialog: () => Promise.resolve({ canceled: true }),
};

const BrowserWindow = class {
  webContents = { send: () => {} };
  static getAllWindows() { return []; }
};

const contextBridge = {
  exposeInMainWorld: () => {},
};

module.exports = {
  app,
  ipcMain,
  ipcRenderer,
  shell,
  dialog,
  BrowserWindow,
  contextBridge,
};
