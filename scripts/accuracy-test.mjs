/**
 * 準確率測試：Ground Truth 標記 + Precision/Recall/F1 計算
 *
 * 使用方式：
 *   npm run test:accuracy          (自動 build:core + 執行)
 *   node scripts/accuracy-test.mjs (僅執行，需先 build:core)
 *
 * 目標小孩: #6（對應個人照 006.jpg）
 * 參考照: test-photos/refs/ (13 張)
 * 掃描照: test-photos/scan/ (149 張)
 *   - 個人照（揮春_個人照/）：42 張，檔名 = 小孩編號
 *   - 群組照（新年服裝_小組/）：30 張，檔名 = 逗號分隔小孩編號
 *   - 活動照（當天照片/）：77 張，需手動標記
 *
 * Ground truth 存放於 test-photos/ground-truth.json，首次執行自動生成。
 * 手動標記後重跑即可更新結果。
 */
import { createRequire } from 'module';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TARGET_CHILD = 6;

// ── Build core modules ──────────────────────────────────────
const CORE_MODULES = ['scrfd', 'align', 'arcface', 'similarity', 'detector', 'embeddings'];
const coreDistDir = path.join(ROOT, 'dist', 'core');

function buildCoreModules() {
  if (!fs.existsSync(coreDistDir)) fs.mkdirSync(coreDistDir, { recursive: true });

  const allExist = CORE_MODULES.every(m => fs.existsSync(path.join(coreDistDir, `${m}.cjs`)));
  if (allExist) {
    console.log('dist/core/ 已存在，跳過編譯（如需重新編譯請刪除 dist/core/）\n');
    return;
  }

  console.log('編譯核心模組到 dist/core/ ...');
  const entries = CORE_MODULES.map(m => `src/core/${m}.ts`).join(' ');
  try {
    execSync(
      `npx tsup ${entries} --format cjs --out-dir dist/core --external electron --external better-sqlite3 --external sharp --external onnxruntime-node --external onnxruntime-common`,
      { stdio: 'inherit', cwd: ROOT }
    );
    console.log('核心模組編譯完成\n');
  } catch (err) {
    console.error('核心模組編譯失敗');
    process.exit(1);
  }
}

buildCoreModules();

// ── Mock electron ────────────────────────────────────────────
const require = createRequire(import.meta.url);
const Module = require('module');
const _origReq = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'electron') {
    return {
      app: {
        getPath: () => path.join(ROOT, '.tmp'),
        getVersion: () => '0',
        isPackaged: false,
        getAppPath: () => ROOT,
      },
    };
  }
  return _origReq.apply(this, arguments);
};

// ── Load compiled modules ────────────────────────────────────
const { cosineSimilarity, computeCentroid } = require(path.join(coreDistDir, 'similarity.cjs'));
// 使用 detectFaces (detector.ts) 而非 detectFacesSCRFD，因為 detector.ts 包含：
// 1. Adaptive confidence filter (丟棄 0.50-0.52 的 false-positive faces)
// 2. 正確的 maxSize 同步 (SCRFD 和 raw buffer 使用相同 maxSize)
// 3. EXIF rotation 處理
const { detectFaces, preloadModel } = require(path.join(coreDistDir, 'detector.cjs'));
// Bootstrapped centroid: 從參考照中正確選出目標小孩的臉
const { selectReferenceEmbeddings } = require(path.join(coreDistDir, 'embeddings.cjs'));
const sharp = require('sharp');

// ── Paths ────────────────────────────────────────────────────
const REFS_DIR = path.join(ROOT, 'test-photos', 'refs');
const SCAN_DIR = path.join(ROOT, 'test-photos', 'scan');
const GROUND_TRUTH_PATH = path.join(ROOT, 'test-photos', 'ground-truth.json');

// ── Helpers ──────────────────────────────────────────────────
function findSubdir(base, name) {
  function walk(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (entry.name === name) return path.join(dir, entry.name);
          const found = walk(path.join(dir, entry.name));
          if (found) return found;
        }
      }
    } catch { /* ignore */ }
    return null;
  }
  return walk(base);
}

function findImages(dir) {
  const result = [];
  if (!dir || !fs.existsSync(dir)) return result;
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(jpg|jpeg|png|webp|heic|heif|bmp|gif)$/i.test(entry.name)) {
        result.push(full);
      }
    }
  }
  walk(dir);
  return result;
}

/**
 * 使用完整 InsightFace pipeline (SCRFD → adaptive filter → alignment → ArcFace)
 * 回傳每個偵測到的臉的 embedding + confidence
 *
 * 這使用 detector.ts 的 detectFaces()，與 APP 實際行為一致：
 * - 自動 EXIF rotation
 * - Adaptive confidence filter (丟棄 score < 0.55 的 false positives)
 * - 統一的 maxSize 座標空間
 */
async function extractAllFaceEmbeddings(imagePath) {
  try {
    const faces = await detectFaces(imagePath, {
      enableAgeGender: false,
      minConfidence: 0.3,
      maxSize: 1280, // 與 APP 的 embed:batch 一致（src/main/index.ts line 923）
    });

    if (faces.length === 0) return { embeddings: [], faceCount: 0 };

    const embeddings = [];
    for (const face of faces) {
      if (face.embedding && face.embedding.length > 0) {
        embeddings.push({ embedding: face.embedding, score: face.confidence });
      }
    }

    return { embeddings, faceCount: faces.length };
  } catch (err) {
    return { embeddings: [], faceCount: 0, error: err.message };
  }
}

// ── Ground truth 生成 / 讀取 ─────────────────────────────────

/**
 * 解析群組照檔名中的小孩編號
 * 例如：「1,2,3,4,5,6,7.jpg」→ [1,2,3,4,5,6,7]
 *       「3,6,7,10,14.jpg 的副本.jpg」→ [3,6,7,10,14]
 */
function parseChildIdsFromFilename(filename) {
  // 去掉副檔名
  let base = filename.replace(/\.(jpg|jpeg|png|webp|heic|heif|bmp|gif)$/i, '');
  // 去掉「的副本」和後續的副檔名
  base = base.replace(/\s*的副本(\.\w+)?$/i, '');
  // 去掉前後空白
  base = base.trim();
  // 用逗號分隔
  const parts = base.split(',');
  const ids = [];
  for (const p of parts) {
    const num = parseInt(p.trim(), 10);
    if (!isNaN(num) && num > 0) ids.push(num);
  }
  return ids;
}

/**
 * 判斷個人照是否為目標小孩
 * 檔名 006.jpg / 006.JPG → true; 001.JPG → false
 */
function isTargetIndividual(filename) {
  const base = filename.replace(/\.(jpg|jpeg|png|webp|heic|heif|bmp|gif)$/i, '').trim();
  const num = parseInt(base, 10);
  return num === TARGET_CHILD;
}

/**
 * 解析「當天照片」資料夾中的檔名
 * 格式：
 *   N.jpg / N_2.jpg / N_3.jpg   → 小孩 #N 的個人照（第 1/2/3 張）
 *   N，M.jpg / N, M.jpg          → 含小孩 #N 和 #M
 *   N(1).jpg                     → 小孩 #N 的變體
 *   大合照.JPG                    → 全班合照（無法判斷，null）
 */
function parseDayPhotoChildIds(filename) {
  let base = filename.replace(/\.(jpg|jpeg|png|webp|heic|heif|bmp|gif)$/i, '').trim();

  // 如果包含中文字（如「大合照」），無法自動判斷
  if (/[\u4e00-\u9fff]/.test(base)) return null;

  // 處理逗號分隔（中文逗號或英文逗號+空格）
  if (/[，,]/.test(base)) {
    const parts = base.split(/[，,]\s*/);
    const ids = [];
    for (const p of parts) {
      const num = parseInt(p.trim(), 10);
      if (!isNaN(num) && num > 0) ids.push(num);
    }
    return ids.length > 0 ? ids : null;
  }

  // 處理 N_2 / N_3 / N(1) 格式 → 取第一個數字作為小孩 ID
  const match = base.match(/^(\d+)(?:[_(]\d+\)?)?$/);
  if (match) {
    const num = parseInt(match[1], 10);
    return num > 0 ? [num] : null;
  }

  return null;
}

function generateGroundTruth(scanDir) {
  const individualDir = findSubdir(scanDir, '揮春_個人照');
  const groupDir = findSubdir(scanDir, '新年服裝_小組');
  const dayDir = findSubdir(scanDir, '當天照片');

  const labels = {};
  let autoTrue = 0;
  let autoFalse = 0;
  let autoNull = 0;

  const allImages = findImages(scanDir);

  for (const imgPath of allImages) {
    const relPath = path.relative(scanDir, imgPath).replace(/\\/g, '/');

    if (individualDir && imgPath.startsWith(individualDir)) {
      // 個人照：根據檔名判斷
      const isTarget = isTargetIndividual(path.basename(imgPath));
      labels[relPath] = isTarget;
      if (isTarget) autoTrue++;
      else autoFalse++;
    } else if (groupDir && imgPath.startsWith(groupDir)) {
      // 群組照：解析檔名中的逗號分隔數字
      const childIds = parseChildIdsFromFilename(path.basename(imgPath));
      if (childIds.length > 0) {
        const isTarget = childIds.includes(TARGET_CHILD);
        labels[relPath] = isTarget;
        if (isTarget) autoTrue++;
        else autoFalse++;
      } else {
        labels[relPath] = null;
        autoNull++;
      }
    } else if (dayDir && imgPath.startsWith(dayDir)) {
      // 當天照片：解析檔名中的小孩編號
      const childIds = parseDayPhotoChildIds(path.basename(imgPath));
      if (childIds !== null) {
        const isTarget = childIds.includes(TARGET_CHILD);
        labels[relPath] = isTarget;
        if (isTarget) autoTrue++;
        else autoFalse++;
      } else {
        labels[relPath] = null;
        autoNull++;
      }
    } else {
      // 其他：需手動標記
      labels[relPath] = null;
      autoNull++;
    }
  }

  const groundTruth = {
    targetChild: TARGET_CHILD,
    labels,
  };

  console.log(`\n自動生成 ground truth:`);
  console.log(`  positive (含目標小孩): ${autoTrue}`);
  console.log(`  negative (不含目標小孩): ${autoFalse}`);
  console.log(`  unlabeled (需手動標記): ${autoNull}`);
  console.log(`  總計: ${autoTrue + autoFalse + autoNull}`);

  return groundTruth;
}

function loadOrCreateGroundTruth() {
  if (fs.existsSync(GROUND_TRUTH_PATH)) {
    console.log(`讀取已有 ground truth: ${GROUND_TRUTH_PATH}`);
    const data = JSON.parse(fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8'));
    // 檢查是否有新增照片需要加入
    const allImages = findImages(SCAN_DIR);
    let newCount = 0;
    for (const imgPath of allImages) {
      const relPath = path.relative(SCAN_DIR, imgPath).replace(/\\/g, '/');
      if (!(relPath in data.labels)) {
        data.labels[relPath] = null;
        newCount++;
      }
    }
    if (newCount > 0) {
      console.log(`  新增 ${newCount} 張未標記照片`);
      fs.writeFileSync(GROUND_TRUTH_PATH, JSON.stringify(data, null, 2), 'utf-8');
    }

    const labeled = Object.values(data.labels).filter(v => v !== null).length;
    const positives = Object.values(data.labels).filter(v => v === true).length;
    const negatives = Object.values(data.labels).filter(v => v === false).length;
    const unlabeled = Object.values(data.labels).filter(v => v === null).length;
    console.log(`  已標記: ${labeled} (${positives} positive, ${negatives} negative)`);
    console.log(`  未標記: ${unlabeled}`);
    return data;
  }

  console.log('首次執行，自動生成 ground truth...');
  const data = generateGroundTruth(SCAN_DIR);
  fs.writeFileSync(GROUND_TRUTH_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`已寫入: ${GROUND_TRUTH_PATH}`);
  return data;
}

// ── Precision / Recall / F1 計算 ─────────────────────────────
function computeMetrics(scores, labels, threshold) {
  let TP = 0, FP = 0, FN = 0, TN = 0;

  for (const { relPath, score } of scores) {
    const label = labels[relPath];
    if (label === null || label === undefined) continue;

    const predicted = score >= threshold;
    if (label === true && predicted) TP++;
    else if (label === false && predicted) FP++;
    else if (label === true && !predicted) FN++;
    else TN++;
  }

  const precision = TP + FP > 0 ? TP / (TP + FP) : null;
  const recall = TP + FN > 0 ? TP / (TP + FN) : null;
  const f1 = precision !== null && recall !== null && (precision + recall) > 0
    ? 2 * precision * recall / (precision + recall)
    : null;

  return { TP, FP, FN, TN, precision, recall, f1 };
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('=== 準確率測試報告 ===\n');

  // Preflight
  if (!fs.existsSync(REFS_DIR)) {
    console.error('test-photos/refs/ 不存在');
    process.exit(1);
  }
  if (!fs.existsSync(SCAN_DIR)) {
    console.error('test-photos/scan/ 不存在');
    process.exit(1);
  }

  // Ground truth
  const groundTruth = loadOrCreateGroundTruth();
  const labels = groundTruth.labels;

  // Load models (使用 detector.ts 的 preloadModel，與 APP 一致)
  console.log('\n載入模型...');
  const modelStart = Date.now();
  await preloadModel();
  console.log(`模型載入完成 (${((Date.now() - modelStart) / 1000).toFixed(1)}s)\n`);

  // Extract reference embeddings using Bootstrapped Centroid
  const refPaths = findImages(REFS_DIR);
  console.log(`處理 ${refPaths.length} 張參考照 (Bootstrapped Centroid)...`);

  const refSelectionResults = await selectReferenceEmbeddings(refPaths, {
    maxSize: 1280,
    minConfidence: 0.01,
    retryOnNoFace: true,
  });

  const refEmbeddings = [];
  for (const result of refSelectionResults) {
    const methodTag = result.selectionMethod === 'bootstrapped'
      ? `bootstrapped(sim=${result.bootstrapSimilarity?.toFixed(3)})`
      : result.selectionMethod;
    if (result.source === 'face') {
      refEmbeddings.push(result.embedding);
      process.stdout.write(
        `  ✓ ${path.basename(result.filePath)} (${result.faceCount} 臉, ${methodTag})\n`
      );
    } else {
      process.stdout.write(
        `  ✗ ${path.basename(result.filePath)} (${methodTag})\n`
      );
    }
  }

  if (refEmbeddings.length === 0) {
    console.error('\n無任何參考照 embedding，無法繼續');
    process.exit(1);
  }

  console.log(`\n有效參考照 embedding: ${refEmbeddings.length}/${refPaths.length}`);

  // Compute centroid of reference embeddings (now from bootstrapped selection)
  const centroid = computeCentroid(refEmbeddings);
  console.log(`Centroid 已計算 (${centroid.length} dims)\n`);

  // Scan all photos and compute similarity
  const allImages = findImages(SCAN_DIR);
  console.log(`處理 ${allImages.length} 張掃描照...\n`);

  const scores = []; // { relPath, score, faceCount, strategy }
  let processed = 0;

  for (const imgPath of allImages) {
    const relPath = path.relative(SCAN_DIR, imgPath).replace(/\\/g, '/');
    const result = await extractAllFaceEmbeddings(imgPath);
    processed++;

    if (result.embeddings.length > 0) {
      // Centroid strategy: similarity between each face and the centroid
      let centroidMax = -1;
      for (const fe of result.embeddings) {
        const sim = cosineSimilarity(fe.embedding, centroid);
        if (sim > centroidMax) centroidMax = sim;
      }

      // Also compute best-of-all-refs for comparison
      let bestMax = -1;
      for (const fe of result.embeddings) {
        for (const re of refEmbeddings) {
          const sim = cosineSimilarity(fe.embedding, re);
          if (sim > bestMax) bestMax = sim;
        }
      }

      scores.push({
        relPath,
        score: centroidMax,       // primary: centroid strategy
        scoreBest: bestMax,       // for comparison
        faceCount: result.faceCount,
      });
    } else {
      scores.push({
        relPath,
        score: 0,
        scoreBest: 0,
        faceCount: 0,
      });
    }

    if (processed % 20 === 0 || processed === allImages.length) {
      process.stdout.write(`  ${processed}/${allImages.length} done...\r`);
    }
  }

  console.log(`\n\n掃描完成: ${scores.length} 張照片`);

  // ── 計算 Precision / Recall / F1 (centroid strategy) ───────
  const thresholds = [];
  for (let t = 0.20; t <= 0.95; t += 0.05) {
    thresholds.push(Math.round(t * 100) / 100);
  }

  const labeledCount = Object.values(labels).filter(v => v !== null).length;
  const posCount = Object.values(labels).filter(v => v === true).length;
  const negCount = Object.values(labels).filter(v => v === false).length;
  const unlabeledCount = Object.values(labels).filter(v => v === null).length;

  console.log('\n' + '═'.repeat(75));
  console.log(`Ground Truth: ${labeledCount} 張已標記 (${posCount} positive, ${negCount} negative), ${unlabeledCount} 張未標記`);
  console.log(`目標小孩: #${TARGET_CHILD}\n`);

  // ── Centroid strategy table ────────────────────────────────
  console.log('=== Precision / Recall / F1 — Centroid Strategy ===\n');
  console.log('門檻    TP  FP  FN  TN   Precision  Recall     F1');
  console.log('─'.repeat(60));

  let bestF1 = -1;
  let bestThreshold = 0;
  const metricsTable = [];

  for (const t of thresholds) {
    const m = computeMetrics(scores, labels, t);
    metricsTable.push({ threshold: t, ...m });

    const pStr = m.precision !== null ? `${(m.precision * 100).toFixed(1)}%` : 'N/A';
    const rStr = m.recall !== null ? `${(m.recall * 100).toFixed(1)}%` : 'N/A';
    const f1Str = m.f1 !== null ? `${(m.f1 * 100).toFixed(1)}%` : 'N/A';
    const marker = m.f1 !== null && m.f1 > bestF1 ? ' ← 最佳' : '';

    if (m.f1 !== null && m.f1 > bestF1) {
      bestF1 = m.f1;
      bestThreshold = t;
    }

    console.log(
      `${t.toFixed(2)}    ${String(m.TP).padStart(2)}  ${String(m.FP).padStart(2)}  ` +
      `${String(m.FN).padStart(2)}  ${String(m.TN).padStart(2)}   ` +
      `${pStr.padStart(9)}  ${rStr.padStart(6)}  ${f1Str.padStart(6)}${marker}`
    );
  }

  console.log(`\n★ 最佳門檻: ${bestThreshold.toFixed(2)} (F1=${bestF1 >= 0 ? (bestF1 * 100).toFixed(1) + '%' : 'N/A'})`);

  // ── Best strategy table for comparison ─────────────────────
  console.log('\n=== Precision / Recall / F1 — Best (Max) Strategy (比較用) ===\n');
  console.log('門檻    TP  FP  FN  TN   Precision  Recall     F1');
  console.log('─'.repeat(60));

  let bestF1Best = -1;
  let bestThresholdBest = 0;

  // Use scoreBest for this table
  for (const t of thresholds) {
    const scoresForBest = scores.map(s => ({ relPath: s.relPath, score: s.scoreBest }));
    const m = computeMetrics(scoresForBest, labels, t);

    const pStr = m.precision !== null ? `${(m.precision * 100).toFixed(1)}%` : 'N/A';
    const rStr = m.recall !== null ? `${(m.recall * 100).toFixed(1)}%` : 'N/A';
    const f1Str = m.f1 !== null ? `${(m.f1 * 100).toFixed(1)}%` : 'N/A';
    const marker = m.f1 !== null && m.f1 > bestF1Best ? ' ← 最佳' : '';

    if (m.f1 !== null && m.f1 > bestF1Best) {
      bestF1Best = m.f1;
      bestThresholdBest = t;
    }

    console.log(
      `${t.toFixed(2)}    ${String(m.TP).padStart(2)}  ${String(m.FP).padStart(2)}  ` +
      `${String(m.FN).padStart(2)}  ${String(m.TN).padStart(2)}   ` +
      `${pStr.padStart(9)}  ${rStr.padStart(6)}  ${f1Str.padStart(6)}${marker}`
    );
  }

  console.log(`\n★ 最佳門檻 (Best strategy): ${bestThresholdBest.toFixed(2)} (F1=${bestF1Best >= 0 ? (bestF1Best * 100).toFixed(1) + '%' : 'N/A'})`);

  // ── 策略比較摘要 ───────────────────────────────────────────
  console.log('\n=== 策略比較 ===');
  console.log(`  Centroid: 最佳 F1=${bestF1 >= 0 ? (bestF1 * 100).toFixed(1) + '%' : 'N/A'} @ threshold=${bestThreshold.toFixed(2)}`);
  console.log(`  Best:     最佳 F1=${bestF1Best >= 0 ? (bestF1Best * 100).toFixed(1) + '%' : 'N/A'} @ threshold=${bestThresholdBest.toFixed(2)}`);

  // ── 錯誤分析 (使用最佳門檻) ────────────────────────────────
  const analysisThreshold = bestThreshold;
  const bestMetrics = computeMetrics(scores, labels, analysisThreshold);

  console.log(`\n=== 錯誤分析 (門檻 ${analysisThreshold.toFixed(2)}) ===\n`);

  // False Positives
  const fps = scores.filter(s => {
    const label = labels[s.relPath];
    return label === false && s.score >= analysisThreshold;
  }).sort((a, b) => b.score - a.score);

  if (fps.length > 0) {
    console.log(`False Positives (${fps.length} 張):`);
    for (const fp of fps) {
      console.log(`  ${(fp.score * 100).toFixed(1)}%  ${fp.relPath}  (label=false, score too high)`);
    }
  } else {
    console.log('False Positives: 無');
  }

  // False Negatives
  const fns = scores.filter(s => {
    const label = labels[s.relPath];
    return label === true && s.score < analysisThreshold;
  }).sort((a, b) => b.score - a.score);

  if (fns.length > 0) {
    console.log(`\nFalse Negatives (${fns.length} 張):`);
    for (const fn of fns) {
      console.log(`  ${(fn.score * 100).toFixed(1)}%  ${fn.relPath}  (label=true, score too low)`);
    }
  } else {
    console.log('\nFalse Negatives: 無');
  }

  // True Positives
  const tps = scores.filter(s => {
    const label = labels[s.relPath];
    return label === true && s.score >= analysisThreshold;
  }).sort((a, b) => b.score - a.score);

  if (tps.length > 0) {
    console.log(`\nTrue Positives (${tps.length} 張):`);
    for (const tp of tps) {
      console.log(`  ${(tp.score * 100).toFixed(1)}%  ${tp.relPath}`);
    }
  }

  // ── 未標記照片排序 ─────────────────────────────────────────
  const unlabeled = scores.filter(s => {
    const label = labels[s.relPath];
    return label === null || label === undefined;
  }).sort((a, b) => b.score - a.score);

  if (unlabeled.length > 0) {
    console.log(`\n=== 未標記照片 (分數排序，供手動標記) ===\n`);
    console.log('排名  相似度   臉數  檔案                                    建議');
    console.log('─'.repeat(80));

    for (let i = 0; i < unlabeled.length; i++) {
      const u = unlabeled[i];
      const sim = (u.score * 100).toFixed(1).padStart(5) + '%';
      const faces = String(u.faceCount).padStart(4);
      const suggestion = u.score >= 0.5 ? '→ 可能 positive'
        : u.score >= 0.3 ? '→ 需確認'
        : '→ 可能 negative';
      console.log(
        `#${String(i + 1).padStart(3)}  ${sim}  ${faces}  ${u.relPath.substring(0, 40).padEnd(40)}  ${suggestion}`
      );
    }
  }

  // ── Top-20 全部照片 ────────────────────────────────────────
  scores.sort((a, b) => b.score - a.score);
  console.log('\n=== Top-20 配對結果 (Centroid) ===\n');
  console.log('排名  相似度   臉數  標記      掃描照片');
  console.log('─'.repeat(90));

  for (let i = 0; i < Math.min(20, scores.length); i++) {
    const r = scores[i];
    const sim = (r.score * 100).toFixed(1).padStart(5) + '%';
    const faces = String(r.faceCount).padStart(4);
    const label = labels[r.relPath];
    const labelStr = label === true ? '✅ true ' : label === false ? '❌ false' : '❓ null ';
    console.log(`#${String(i + 1).padStart(3)}  ${sim}  ${faces}  ${labelStr}  ${r.relPath}`);
  }

  // ── 最終摘要 ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(75));
  console.log('=== 最終摘要 ===\n');
  console.log(`目標小孩: #${TARGET_CHILD}`);
  console.log(`參考照: ${refEmbeddings.length}/${refPaths.length} (有臉/總計)`);
  console.log(`掃描照: ${scores.length}`);
  console.log(`Ground Truth: ${labeledCount} 已標記, ${unlabeledCount} 未標記`);
  console.log(`\nCentroid Strategy:`);
  console.log(`  最佳門檻: ${bestThreshold.toFixed(2)}`);
  console.log(`  Precision: ${bestMetrics.precision !== null ? (bestMetrics.precision * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log(`  Recall:    ${bestMetrics.recall !== null ? (bestMetrics.recall * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log(`  F1:        ${bestMetrics.f1 !== null ? (bestMetrics.f1 * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log(`  TP=${bestMetrics.TP} FP=${bestMetrics.FP} FN=${bestMetrics.FN} TN=${bestMetrics.TN}`);
  console.log(`\n提示: 手動編輯 test-photos/ground-truth.json 將 null → true/false，重跑本測試即可更新結果。`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
