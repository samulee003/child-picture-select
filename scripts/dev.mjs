#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting development server...');

// Start the development server
const devProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

devProcess.on('close', (code) => {
  console.log(`Development process exited with code ${code}`);
  process.exit(code);
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