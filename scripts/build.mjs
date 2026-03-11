#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting build process...');

// Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
  execSync('npm run clean', { stdio: 'inherit' });
} catch (error) {
  console.warn('Clean step failed, continuing...');
}

// Type checking
console.log('🔍 Running type check...');
try {
  execSync('npm run typecheck', { stdio: 'inherit' });
  console.log('✅ Type check passed');
} catch (error) {
  console.error('❌ Type check failed');
  process.exit(1);
}

// Linting
console.log('🔍 Running lint check...');
try {
  execSync('npm run lint:check', { stdio: 'inherit' });
  console.log('✅ Lint check passed');
} catch (error) {
  console.warn('⚠️  Lint check had warnings, continuing...');
}

// Build application - use the individual build scripts instead of recursive call
console.log('📦 Building application...');
try {
  // Build main process
  console.log('Building main process...');
  execSync('npm run build:main', { stdio: 'inherit' });
  
  // Build preload
  console.log('Building preload...');
  execSync('npm run build:preload', { stdio: 'inherit' });
  
  // Build renderer
  console.log('Building renderer...');
  execSync('npm run build:renderer', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}