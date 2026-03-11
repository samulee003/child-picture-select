// Bootstraps TypeScript preload in dev
try {
  require('ts-node/register/transpile-only');
} catch {}
require('./preload.ts');


