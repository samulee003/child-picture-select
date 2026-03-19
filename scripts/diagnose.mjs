#!/usr/bin/env node
/**
 * 人臉載入診斷工具
 * 檢查所有可能導致人臉檢測失敗的問題
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🔍 Find My Kid - 人臉載入診斷工具\n');
console.log('='.repeat(60));

// 1. 檢查模型檔案
console.log('\n📦 1. 檢查模型檔案');
console.log('-'.repeat(60));
const modelsDir = path.join(rootDir, 'models', 'insightface');
const requiredModels = ['det_500m.onnx', 'w600k_mbf.onnx'];

if (!fs.existsSync(modelsDir)) {
  console.log('❌ 模型目錄不存在:', modelsDir);
} else {
  console.log('✅ 模型目錄存在:', modelsDir);

  requiredModels.forEach(model => {
    const modelPath = path.join(modelsDir, model);
    if (fs.existsSync(modelPath)) {
      const stats = fs.statSync(modelPath);
      console.log(`✅ ${model} 存在 (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.log(`❌ ${model} 不存在`);
    }
  });
}

// 2. 檢查 Node modules
console.log('\n📦 2. 檢查關鍵依賴');
console.log('-'.repeat(60));
const criticalModules = ['sharp', 'better-sqlite3', 'onnxruntime-node'];

criticalModules.forEach(mod => {
  try {
    const modulePath = path.join(rootDir, 'node_modules', mod);
    if (fs.existsSync(modulePath)) {
      console.log(`✅ ${mod} 已安裝`);
    } else {
      console.log(`❌ ${mod} 未安裝`);
    }
  } catch {
    console.log(`❌ ${mod} 未安裝`);
  }
});

// 3. 檢查建置檔案
console.log('\n📦 3. 檢查建置檔案');
console.log('-'.repeat(60));
const buildFiles = [
  path.join(rootDir, 'dist/main/index.cjs'),
  path.join(rootDir, 'dist/preload/index.cjs'),
  path.join(rootDir, 'dist/renderer/index.html'),
];

buildFiles.forEach(file => {
  const relativePath = path.relative(rootDir, file);
  if (fs.existsSync(file)) {
    console.log(`✅ ${relativePath} 存在`);
  } else {
    console.log(`❌ ${relativePath} 不存在 (請執行 npm run build)`);
  }
});

// 4. 檢查測試圖片（如果存在）
console.log('\n📦 4. 測試圖片處理');
console.log('-'.repeat(60));
const testImages = [
  path.join(rootDir, 'resources/test-photo.jpg'),
  path.join(rootDir, 'resources/logo.png'),
];

let canProcessImage = false;
testImages.forEach(img => {
  if (fs.existsSync(img)) {
    console.log(`✅ 找到測試圖片: ${path.relative(rootDir, img)}`);
    canProcessImage = true;
  }
});

if (!canProcessImage) {
  console.log('⚠️  未找到測試圖片，建議準備一張人像照片進行測試');
}

// 5. 檢查資料庫目錄權限
console.log('\n📦 5. 檢查資料儲存目錄');
console.log('-'.repeat(60));
const userDataDir = process.env.APPDATA || path.join(process.env.HOME || '', 'AppData/Roaming');
const appDataDir = path.join(userDataDir, '大海撈Ｂ');

console.log('應用資料目錄:', appDataDir);
if (!fs.existsSync(appDataDir)) {
  console.log('ℹ️  資料目錄尚未建立（首次執行時會自動建立）');
} else {
  try {
    fs.accessSync(appDataDir, fs.constants.W_OK);
    console.log('✅ 資料目錄可寫入');

    // 檢查是否有資料庫檔案
    const dbPath = path.join(appDataDir, 'cache.sqlite');
    if (fs.existsSync(dbPath)) {
      console.log('✅ 資料庫檔案存在');
    } else {
      console.log('ℹ️  資料庫尚未建立');
    }
  } catch {
    console.log('❌ 資料目錄無法寫入（權限問題）');
  }
}

console.log('\n' + '='.repeat(60));
console.log('📝 診斷完成\n');

console.log('💡 常見問題解決方案：');
console.log('1. 如果模型檔案缺失，請執行: npm run download-models');
console.log('2. 如果建置檔案缺失，請執行: npm run build');
console.log('3. 如果依賴缺失，請執行: npm install');
console.log('4. 如果資料庫損壞，請刪除:', path.join(appDataDir, 'cache.sqlite'));
console.log('');
console.log('🚀 啟動應用測試：');
console.log('   開發模式: npm run dev');
console.log('   生產模式: npm start');
console.log('');
console.log('📝 人臉載入失敗排查步驟：');
console.log('1. 確認模型檔案存在（det_500m.onnx + w600k_mbf.onnx）');
console.log('2. 使用正面清晰的人像照片作為參考照');
console.log('3. 檢查終端輸出是否有 [ERROR] 或 [WARN] 級別的錯誤');
console.log('4. 如果出現 timeout，增加 minConfidence 門檻值');
console.log('5. 清除快取重試：刪除', path.join(appDataDir, 'cache.sqlite'));
