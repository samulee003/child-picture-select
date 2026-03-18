/**
 * 下載 InsightFace ArcFace ONNX 模型（buffalo_sc pack）
 *
 * 模型：w600k_mbf.onnx（MobileNet backbone, ArcFace loss, WebFace600K）
 * 大小：約 18 MB
 * 目標路徑：<project_root>/models/insightface/w600k_mbf.onnx
 *
 * 此腳本會在 npm install 後自動執行（postinstall）。
 * 若已下載則直接跳過。如果網路不通，會印出警告並繼續（不影響安裝）。
 */

import { existsSync, mkdirSync, createWriteStream, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const modelsDir = join(projectRoot, 'models', 'insightface');
const modelPath = join(modelsDir, 'w600k_mbf.onnx');

/**
 * buffalo_sc pack 中的 w600k_mbf.onnx（ArcFace MobileNet，~18 MB）
 * 使用 HuggingFace 鏡像以確保穩定性
 */
const MODEL_URL =
  'https://huggingface.co/deepinsight/insightface/resolve/main/models/buffalo_sc/w600k_mbf.onnx';

/** 最小可接受的模型大小（bytes）— 防止下載不完整的檔案 */
const MIN_MODEL_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    https
      .get(url, { headers: { 'User-Agent': 'da-hai-lao-b/postinstall' } }, (response) => {
        // Handle HTTP redirect
        if (response.statusCode === 301 || response.statusCode === 302) {
          const location = response.headers.location;
          if (!location) {
            reject(new Error(`Redirect without Location header (${response.statusCode})`));
            return;
          }
          response.resume();
          downloadFile(location, destPath, maxRedirects - 1).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode} from ${url}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let receivedBytes = 0;
        let lastPct = -1;

        const stream = createWriteStream(destPath);

        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            const pct = Math.floor((receivedBytes / totalBytes) * 100);
            if (pct !== lastPct && pct % 10 === 0) {
              process.stdout.write(
                `\r  Downloading w600k_mbf.onnx: ${pct}% ` +
                `(${(receivedBytes / 1024 / 1024).toFixed(1)} / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`
              );
              lastPct = pct;
            }
          }
        });

        response.pipe(stream);

        stream.on('finish', () => {
          process.stdout.write('\n');
          resolve(receivedBytes);
        });

        stream.on('error', reject);
        response.on('error', reject);
      })
      .on('error', reject);
  });
}

async function main() {
  // 已存在且大小正確 → 跳過
  if (existsSync(modelPath)) {
    const { statSync } = await import('fs');
    const size = statSync(modelPath).size;
    if (size >= MIN_MODEL_SIZE_BYTES) {
      console.log(
        `[download-models] ArcFace model already present (${(size / 1024 / 1024).toFixed(1)} MB): ${modelPath}`
      );
      return;
    }
    console.warn(
      `[download-models] Model file too small (${size} bytes), re-downloading...`
    );
    unlinkSync(modelPath);
  }

  mkdirSync(modelsDir, { recursive: true });

  console.log('[download-models] Downloading InsightFace ArcFace model (w600k_mbf, ~18 MB)...');
  console.log(`[download-models] URL: ${MODEL_URL}`);
  console.log(`[download-models] Destination: ${modelPath}`);

  try {
    const receivedBytes = await downloadFile(MODEL_URL, modelPath);
    const mb = (receivedBytes / 1024 / 1024).toFixed(1);

    if (receivedBytes < MIN_MODEL_SIZE_BYTES) {
      unlinkSync(modelPath);
      throw new Error(`Downloaded file too small (${receivedBytes} bytes), likely corrupt`);
    }

    console.log(`[download-models] ✅ ArcFace model downloaded (${mb} MB)`);
  } catch (err) {
    // 下載失敗不中斷安裝 — 應用程式啟動時會降級到 deterministic fallback
    if (existsSync(modelPath)) {
      try { unlinkSync(modelPath); } catch { /* ignore */ }
    }
    console.warn(
      `[download-models] ⚠️  Failed to download ArcFace model: ${err.message}`
    );
    console.warn(
      `[download-models]    Face recognition will use deterministic fallback until model is available.`
    );
    console.warn(
      `[download-models]    Retry manually: npm run download-models`
    );
  }
}

main();
