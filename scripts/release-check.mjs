#!/usr/bin/env node

import { existsSync } from 'fs';
import { join } from 'path';

console.log('📋 上線前檢查...');

const checks = [
  {
    name: '應用圖示 (resources/logo.ico)',
    path: join(process.cwd(), 'resources', 'logo.ico'),
  },
  {
    name: '預設模型資料夾 (resources/models)',
    path: join(process.cwd(), 'resources', 'models'),
  },
];

const warnings = [];

for (const check of checks) {
  if (!existsSync(check.path)) {
    warnings.push(`❗ ${check.name} 不存在`);
  } else {
    console.log(`✅ ${check.name}`);
  }
}

if (warnings.length > 0) {
  console.log('\n⚠️  已為上線產物提供降級方案，已繼續執行：');
  for (const warning of warnings) {
    console.log(warning);
  }
  if (checks.some((item) => item.name.includes('應用圖示'))) {
    console.log('\n建議補上正式 logo 檔案：resources/logo.ico（先可使用暫版，之後再替換為正式圖）');
  }
} else {
  console.log('\n✅ 主要上線檔案都已就緒');
}

console.log('\n🚀 進入下一步 packaging');

