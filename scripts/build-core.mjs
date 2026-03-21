#!/usr/bin/env node
/**
 * Build core modules for testing
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CORE_MODULES = [
  'src/core/align.ts',
  'src/core/scrfd.ts',
  'src/core/arcface.ts',
  'src/core/onnx-gpu.ts',
];

console.log('🔨 Building core modules for testing...');

if (!fs.existsSync('dist/core')) {
  fs.mkdirSync('dist/core', { recursive: true });
}

for (const module of CORE_MODULES) {
  const basename = path.basename(module, '.ts');
  console.log(`Building ${basename}...`);
  try {
    execSync(
      `npx tsup ${module} --format cjs --out-dir dist/core --external electron --external sharp --external onnxruntime-node --external better-sqlite3`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error(`Failed to build ${basename}`);
    process.exit(1);
  }
}

console.log('✅ Core modules built successfully');
