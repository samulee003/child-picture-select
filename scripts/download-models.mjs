/**
 * 下載 InsightFace ONNX 模型
 *
 * 偵測模型：det_500m.onnx（SCRFD detection, 2.5 MB）
 *   來源：InsightFace 官方 GitHub Releases（buffalo_sc.zip）
 *
 * 識別模型：w600k_r50.onnx（ResNet-50 backbone, ArcFace loss, WebFace600K，174 MB）
 *   來源：HuggingFace public-data/insightface（直接下載，不需登入）
 *   相較舊版 w600k_mbf（MobileFaceNet），R50 對小臉、模糊、低光照場景容忍度顯著提升，
 *   更適合兒童照片辨識。
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
const arcfacePath = join(modelsDir, 'w600k_r50.onnx');
const scrfdPath = join(modelsDir, 'det_500m.onnx');

/**
 * buffalo_sc.zip 包含 det_500m.onnx（SCRFD detection）
 * w600k_r50.onnx 從 HuggingFace 直接下載
 */
const BUFFALO_SC_ZIP_URL =
  'https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_sc.zip';

const R50_ONNX_URL =
  'https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx';

const MIN_ARCFACE_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB（真實約 174 MB）
const MIN_SCRFD_SIZE_BYTES = 1 * 1024 * 1024;      // 1 MB（真實約 2.5 MB）

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
    const tmpExtract = join(tmpdir(), 'buffalo_sc_extract');
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpExtract}' -Force"`,
      { stdio: 'pipe' }
    );
    const extracted = join(tmpExtract, filename);
    if (!existsSync(extracted)) throw new Error(`${filename} not found in zip`);
    execSync(`move /Y "${extracted}" "${destPath}"`, { stdio: 'pipe', shell: true });
  } else {
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

  if (arcfaceReady && scrfdReady) {
    const arcSize = (statSync(arcfacePath).size / 1024 / 1024).toFixed(1);
    const scrfdSize = (statSync(scrfdPath).size / 1024 / 1024).toFixed(1);
    console.log(
      `[download-models] Models already present — ArcFace R50 (${arcSize} MB), SCRFD (${scrfdSize} MB) — skipping.`
    );
    return;
  }

  mkdirSync(modelsDir, { recursive: true });

  // 1. 下載 det_500m.onnx（從 buffalo_sc.zip）
  if (!scrfdReady) {
    const zipPath = join(tmpdir(), 'buffalo_sc.zip');
    console.log('[download-models] Downloading det_500m.onnx via buffalo_sc.zip (~15 MB)...');
    console.log(`[download-models] Source: ${BUFFALO_SC_ZIP_URL}`);
    try {
      const zipBytes = await downloadFile(BUFFALO_SC_ZIP_URL, zipPath);
      console.log(`[download-models] Downloaded zip: ${(zipBytes / 1024 / 1024).toFixed(1)} MB`);

      console.log('[download-models] Extracting det_500m.onnx (SCRFD detection)...');
      extractFromZip(zipPath, 'det_500m.onnx', scrfdPath);

      if (!existsSync(scrfdPath)) throw new Error('SCRFD extraction produced no output');
      const size = statSync(scrfdPath).size;
      if (size < MIN_SCRFD_SIZE_BYTES) {
        unlinkSync(scrfdPath);
        throw new Error(`SCRFD file too small (${size} bytes)`);
      }
      console.log(`[download-models] ✅ SCRFD ready (${(size / 1024 / 1024).toFixed(1)} MB)`);
      try { unlinkSync(zipPath); } catch { /* ignore */ }
    } catch (err) {
      console.warn(`[download-models] ⚠️  SCRFD download failed: ${err.message}`);
      console.warn(`[download-models]    Retry: npm run download-models`);
    }
  }

  // 2. 下載 w600k_r50.onnx（從 HuggingFace，直接下載，約 174 MB）
  if (!arcfaceReady) {
    console.log('[download-models] Downloading w600k_r50.onnx (ArcFace R50, ~174 MB)...');
    console.log(`[download-models] Source: ${R50_ONNX_URL}`);
    console.log('[download-models] This is a one-time download. Please wait...');
    const tmpArc = arcfacePath + '.tmp';
    try {
      const bytes = await downloadFile(R50_ONNX_URL, tmpArc);
      console.log(`[download-models] Downloaded: ${(bytes / 1024 / 1024).toFixed(1)} MB`);

      if (bytes < MIN_ARCFACE_SIZE_BYTES) {
        unlinkSync(tmpArc);
        throw new Error(`ArcFace file too small (${bytes} bytes) — download may have been truncated`);
      }

      // Atomic rename
      if (process.platform === 'win32') {
        execSync(`move /Y "${tmpArc}" "${arcfacePath}"`, { stdio: 'pipe', shell: true });
      } else {
        execSync(`mv "${tmpArc}" "${arcfacePath}"`, { stdio: 'pipe' });
      }

      const size = statSync(arcfacePath).size;
      console.log(`[download-models] ✅ ArcFace R50 ready (${(size / 1024 / 1024).toFixed(1)} MB)`);
    } catch (err) {
      try { if (existsSync(tmpArc)) unlinkSync(tmpArc); } catch { /* ignore */ }
      console.warn(`[download-models] ⚠️  ArcFace R50 download failed: ${err.message}`);
      console.warn(`[download-models]    Face recognition will use deterministic fallback.`);
      console.warn(`[download-models]    Retry: npm run download-models`);
    }
  }

  if (isModelValid(arcfacePath, MIN_ARCFACE_SIZE_BYTES) && isModelValid(scrfdPath, MIN_SCRFD_SIZE_BYTES)) {
    console.log('[download-models] ✅ All InsightFace models ready (SCRFD + ArcFace R50)');
  }
}

main();
