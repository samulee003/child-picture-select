#!/usr/bin/env node

/**
 * 開發環境啟動腳本
 *
 * 並行啟動：
 *   - tsup watch (main process)
 *   - tsup watch (preload)
 *   - Vite dev server (renderer, :5173)
 *   - Electron app (等 :5173 就緒後啟動)
 */

import { spawn } from 'child_process';

console.log('🚀 Starting development server...');

// Explicitly list the four dev processes (avoids npm:dev:* glob matching dev:legacy itself)
const devProcess = spawn(
  'npx',
  [
    'concurrently',
    '-k',
    '--names', 'main,preload,renderer,app',
    'npm:dev:main',
    'npm:dev:preload',
    'npm:dev:renderer',
    'npm:dev:app',
  ],
  {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  }
);

devProcess.on('close', (code) => {
  console.log(`Development process exited with code ${code}`);
  process.exit(code ?? 0);
});

devProcess.on('error', (error) => {
  console.error('Failed to start development server:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  devProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development server...');
  devProcess.kill('SIGTERM');
});
