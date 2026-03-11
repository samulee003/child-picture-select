import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  scanFolder: (dir: string) => ipcRenderer.invoke('scan:folder', dir),
  embedReferences: (files: string[]) => ipcRenderer.invoke('embed:references', files),
  runScan: (dir: string) => ipcRenderer.invoke('embed:batch', dir),
  runMatch: (opts: { topN: number; threshold: number }) => ipcRenderer.invoke('match:run', opts),
  exportCopy: (files: string[], outDir: string) => ipcRenderer.invoke('export:copy', { files, outDir })
});

export {};


