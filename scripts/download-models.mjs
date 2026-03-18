/**
 * 下載 InsightFace ArcFace ONNX 模型（buffalo_sc pack）
 *
 * 模型：w600k_mbf.onnx（MobileNet backbone, ArcFace loss, WebFace600K）
 * 大小：約 13 MB（zip 約 15 MB）
 * 來源：InsightFace 官方 GitHub Releases（公開，不需登入）
 * 目標：<project_root>/models/insightface/w600k_mbf.onnx
 *
 * 此腳本在 npm install 後自動執行（postinstall）。
 * 已存在且大小正確 → 直接跳過。
 * 下載失敗 → 警告並繼續（應用程式啟動時降級為 deterministic fallback）。
 */

import { existsSync, mkdirSync, createWriteStream, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const modelsDir = join(projectRoot, 'models', 'insightface');
const arcfacePath = join(modelsDir, 'w600k_mbf.onnx');
const scrfdPath = join(modelsDir, 'det_500m.onnx');

// Backward compat alias
const modelPath = arcfacePath;

/**
 * buffalo_sc.zip 包含：
 *   - det_500m.onnx  (SCRFD detection, 2.5 MB) ← 需要
 *   - w600k_mbf.onnx (ArcFace recognition, 13 MB) ← 需要
 */
const BUFFALO_SC_ZIP_URL =
  'https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_sc.zip';

const MIN_ARCFACE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB（真實約 13 MB）
const MIN_SCRFD_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB（真實約 2.5 MB）
const MIN_MODEL_SIZE_BYTES = MIN_ARCFACE_SIZE_BYTES; // backward compat

function downloadFile(url, destPath, maxRedirects = 8) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    https
      .get(url, { headers: { 'User-Agent': 'da-hai-lao-b/postinstall' } }, (response) => {
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
                `\r  ${pct}% (${(receivedBytes / 1024 / 1024).toFixed(1)} / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)   `
              );
              lastPct = pct;
            }
          }
        });

        response.pipe(stream);
        stream.on('finish', () => { process.stdout.write('\n'); resolve(receivedBytes); });
        stream.on('error', reject);
        response.on('error', reject);
      })
      .on('error', reject);
  });
}

/**
 * 從 ZIP 檔案中解壓單一檔案到目的路徑
 * 跨平台：Linux/macOS 使用 unzip，Windows 使用 PowerShell Expand-Archive
 */
function extractFromZip(zipPath, filename, destPath) {
  if (process.platform === 'win32') {
    // PowerShell: 解壓縮 ZIP 並取出指定檔案
    const tmpExtract = join(tmpdir(), 'buffalo_sc_extract');
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpExtract}' -Force"`,
      { stdio: 'pipe' }
    );
    const extracted = join(tmpExtract, filename);
    if (!existsSync(extracted)) throw new Error(`${filename} not found in zip`);
    execSync(`move /Y "${extracted}" "${destPath}"`, { stdio: 'pipe', shell: true });
  } else {
    // unzip: -p = pipe file to stdout, redirect to destPath
    // 或用 -o -j 直接解壓到指定目錄
    execSync(`unzip -o -j "${zipPath}" "${filename}" -d "${dirname(destPath)}"`, {
      stdio: 'pipe',
    });
  }
}

function isModelValid(path, minSize) {
  if (!existsSync(path)) return false;
  return statSync(path).size >= minSize;
}

async function main() {
  const arcfaceReady = isModelValid(arcfacePath, MIN_ARCFACE_SIZE_BYTES);
  const scrfdReady = isModelValid(scrfdPath, MIN_SCRFD_SIZE_BYTES);

  // 兩個模型都已存在且大小正確 → 跳過
  if (arcfaceReady && scrfdReady) {
    const arcSize = (statSync(arcfacePath).size / 1024 / 1024).toFixed(1);
    const scrfdSize = (statSync(scrfdPath).size / 1024 / 1024).toFixed(1);
    console.log(
      `[download-models] Models already present — ArcFace (${arcSize} MB), SCRFD (${scrfdSize} MB) — skipping.`
    );
    return;
  }

  mkdirSync(modelsDir, { recursive: true });

  const zipPath = join(tmpdir(), 'buffalo_sc.zip');

  console.log('[download-models] Downloading InsightFace buffalo_sc.zip (~15 MB)...');
  console.log(`[download-models] Source: ${BUFFALO_SC_ZIP_URL}`);
  console.log(`[download-models] Targets: ${arcfacePath}, ${scrfdPath}`);

  try {
    // 1. 下載 zip
    const zipBytes = await downloadFile(BUFFALO_SC_ZIP_URL, zipPath);
    console.log(`[download-models] Downloaded zip: ${(zipBytes / 1024 / 1024).toFixed(1)} MB`);

    // 2. 解壓 w600k_mbf.onnx (ArcFace recognition)
    if (!arcfaceReady) {
      console.log('[download-models] Extracting w600k_mbf.onnx (ArcFace recognition)...');
      extractFromZip(zipPath, 'w600k_mbf.onnx', arcfacePath);

      if (!existsSync(arcfacePath)) throw new Error('ArcFace extraction produced no output');
      const size = statSync(arcfacePath).size;
      if (size < MIN_ARCFACE_SIZE_BYTES) {
        unlinkSync(arcfacePath);
        throw new Error(`ArcFace file too small (${size} bytes)`);
      }
      console.log(`[download-models] ✅ ArcFace ready (${(size / 1024 / 1024).toFixed(1)} MB)`);
    }

    // 3. 解壓 det_500m.onnx (SCRFD detection)
    if (!scrfdReady) {
      console.log('[download-models] Extracting det_500m.onnx (SCRFD detection)...');
      extractFromZip(zipPath, 'det_500m.onnx', scrfdPath);

      if (!existsSync(scrfdPath)) throw new Error('SCRFD extraction produced no output');
      const size = statSync(scrfdPath).size;
      if (size < MIN_SCRFD_SIZE_BYTES) {
        unlinkSync(scrfdPath);
        throw new Error(`SCRFD file too small (${size} bytes)`);
      }
      console.log(`[download-models] ✅ SCRFD ready (${(size / 1024 / 1024).toFixed(1)} MB)`);
    }

    console.log('[download-models] ✅ All InsightFace models ready (SCRFD + ArcFace)');

    // 清理 zip
    try { unlinkSync(zipPath); } catch { /* ignore */ }
  } catch (err) {
    console.warn(`[download-models] ⚠️  Download failed: ${err.message}`);
    console.warn(`[download-models]    Face recognition will use deterministic fallback.`);
    console.warn(`[download-models]    Retry: npm run download-models`);
  }
}

main();
