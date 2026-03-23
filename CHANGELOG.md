## Changelog - Find My Kid (Offline)

### v0.2.27 – 接入 ReferencePhotoQualityCard / TaskReadinessCard / ScanWarningsPanel + ModernProgress（2026-03-23）

**UI 主流程改善**

- **`ReferencePhotoQualityCard`**：載入參考照後自動呼叫 `assess:photo-quality`，以富卡片（縮圖 + 評分徽章 + 銳度/亮度/解析度指標 + 智能增強/移除按鈕）取代原本的小縮圖格子；質量資料尚未取回前仍顯示原有格子作為 fallback
- **`TaskReadinessCard`**：在掃描按鈕上方加入前置檢查清單（參考照片 / 掃描資料夾 / AI 模型），協助使用者快速確認是否就緒
- **`ScanWarningsPanel`**：掃描完成後若有警告訊息，在結果列表上方以黃色警示框顯示
- **`ModernProgress`**：載入參考照 / 計算相似度等過渡期間（無進度資料時）顯示動態進度條，避免空白等待感
- 清除按鈕同步清空 `refPhotoQualities`，避免舊數據殘留

### v0.2.26 – Hi-res SCRFD 重偵測 + Bootstrapped Centroid，F1: 40% → 85.7%（2026-03-23）

**核心演算法改進**

- **Bootstrapped Centroid（`selectReferenceEmbeddings()`）**：解決參考照包含多張臉（父母、兄弟姐妹）時選錯臉汙染 centroid 的問題
  - 演算法：用單臉參考照建立 initialCentroid → 用 initialCentroid 從多臉參考照中選正確的小孩臉 → 重算 finalCentroid
  - 實測：2 張參考照（4 臉的 IMG_5285.JPG）從 sim=0.096（錯的大人臉）修正到 sim=0.636（正確的小孩臉）
  - Fallback：若沒有任何單臉參考照，退回原本的最高信心度選臉
  - `src/core/embeddings.ts`：新增 `selectReferenceEmbeddings()` 函式 + `ReferenceSelectionResult` 介面
  - `src/main/index.ts`：`embed:references` handler 改用 `selectReferenceEmbeddings()`

**準確率測試框架**

- 新增 `scripts/accuracy-test.mjs`：Ground Truth 標記 + Precision/Recall/F1 計算
  - 自動標記個人照（006.jpg → positive，其餘 → negative）和群組照（檔名含 "6" → positive）
  - 對每個門檻 0.20-0.95 計算 TP/FP/FN/TN + P/R/F1
  - 同時比較 Centroid 和 Best 兩種策略
  - 錯誤分析（FP/FN 列表）+ 未標記照片分數排序（供手動標記）
  - 使用 `detector.ts` 的 `detectFaces()`（含 adaptive confidence filter），修正原先使用 raw `detectFacesSCRFD` 的問題
  - 修正 maxSize=1280（匹配 APP 實際 `embed:batch` 行為）
- 新增 `test-photos/ground-truth.json`：自動生成的 ground truth（72 張已標記）
- `package.json`：新增 `test:accuracy` script

**測試**

- 新增 `src/core/embeddings.test.ts`：`selectReferenceEmbeddings()` 的 7 個單元測試
  - 全部單臉、混合單臉+多臉（bootstrapped 選臉驗證）、全部多臉 fallback
  - 偵測失敗 deterministic fallback、L2 正規化驗證

**高解析度 SCRFD 重偵測（小臉品質大幅提升）**

- **小臉 hi-res 重偵測**：群組照中的小臉（<112px）在低解析度下 SCRFD keypoints 不準，alignment 品質差
  - 解法：從原圖全解析度裁切臉部區域 → 重新跑 SCRFD 獲得全新精確 keypoints → 高解析度 alignment + ArcFace
  - 使用 ADAPTIVE_MIN_CONF (0.55) 過濾 hi-res 裁切上的 false-positive
  - 自動選擇最接近原始偵測位置的臉（避免選到鄰居）
  - Fallback：若 hi-res SCRFD 偵測失敗，退回 scaled keypoints 方案
- `src/core/scrfd.ts`：`detectFacesSCRFD` 參數型別擴展為 `string | Buffer`，支援直接傳入 PNG buffer

**UI 修正**

- 多照融合方式新增「重心」選項（centroid），標示為預設且準確率最高
- 修正 UI 顯示 '最高分' 為預設但後端實際使用 centroid 的不一致問題

**準確率（72 張已標記照片）**

- **F1=85.7%** @ 門檻 0.60，Precision=100%，Recall=75%（4 positive 中找到 3 個）
- @ 門檻 0.55：F1=66.7%，Precision=50%，Recall=100%（全部 4 個 positive 找到，僅 4 個 FP）
- 群組照分數大幅提升：
  - `3,6,7,10,14.jpg`: 36.3% → **67.8%** (+31.5%)
  - `6,15,18,33.jpg`: 49.9% → **66.8%** (+16.9%)
  - `1,2,3,4,5,6,7.jpg`: 26.4% → **55.2%** (+28.8%)
- 個人照 006.jpg 維持排名 #1（76.6%）

---

### v0.2.24 – Centroid 策略接通 UI + 參考引導選臉 + 審計修復（2026-03-23）

**核心功能修復**

- **`match:run` 預設策略改為 `'centroid'`**：v0.2.23 新增的 `computeCentroid()` 和 `'centroid'` 策略從未被 UI 使用過——preload、types、renderer 的型別定義只有 `'best' | 'average' | 'weighted'`，且預設值為 `'best'`。本次修正：
  - `src/preload/index.ts`：strategy 型別新增 `'centroid'`
  - `src/types/api.ts`：`ElectronAPI.runMatch` 新增 `'centroid'`
  - `src/renderer/hooks/useScanState.ts`：預設值改為 `'centroid'`
  - `src/main/index.ts`：`match:run` handler 預設值改為 `'centroid'`

- **參考引導選臉（Reference-Guided Face Selection）**：解決群組照片中目標小孩不是最大臉的問題。
  - `src/core/embeddings.ts`：`EmbeddingOptions` 新增 `referenceEmbeddings?: number[][]`
  - 當偵測到多張臉時，計算參考照 centroid，選擇與 centroid 最相似的臉（而非最高信心度的臉）
  - `src/main/index.ts`：`embed:batch` 在掃描前提取 face-source 參考 embeddings，傳給 `fileToEmbeddingWithSource`

**程式碼正確性修復**

- **`src/core/align.ts`（KPS 裁切路徑 bug）**：超大圖（>4MP）裁切路徑改用 `adjustedKps`
- **`src/core/align.ts`（誤導性注釋）**：修正為正確說明 pipeline 啟用了 `.rotate()` 自動旋轉

**文件更新（CLAUDE.md）**

- 更新 `align.ts` 模組描述：純 JS 逆向雙線性插值，`exifOrientation=1` 設計意圖
- 新增 Common Pitfall #21：群組照片單 embedding 限制（已透過參考引導選臉緩解）
- 新增 Common Pitfall #22：`transformKpsForOrientation()` 防禦性代碼說明

**整合測試結果（149 張真實照片）**

- 12/12 測試全部通過
- Top-1 相似度: 90.4%, Top-10 均值: 89.3%
- 個人照配對 ≥0.4: 39/42, 團體照找人 ≥0.3: 30/30

---

### v0.2.23 – 修復人臉辨識三個致命 bug（2026-03-22）

**核心修復（006.jpg 排名從 #38 → #1）**

- **`src/core/scrfd.ts`**：啟用 EXIF 自動旋轉（`.rotate()`），修復手機直拍照片（orientation=6/8）橫躺臉部偵測不到的問題，ref 偵測率 5/13 → 13/13
- **`src/core/detector.ts`**：統一 SCRFD 與 raw buffer 的 `maxSize`（預設 2048），修復座標空間不匹配導致 alignment 對到背景而非臉部的致命錯誤
- **`src/core/detector.ts`**：新增 Adaptive confidence filter（≥0.55），防止 SCRFD false positive 假臉干擾 ArcFace
- **`src/core/similarity.ts`**：新增 `computeCentroid()` 函數，將多張 ref embedding 平均後 L2 歸一化，形成唯一原型向量，消除 `best` 策略虛高問題

**Cache 版本更新**

- **`src/core/db.ts`**：`CURRENT_CACHE_VERSION` v5 → v6，清除舊有無效 embedding 快取

---

### v0.2.22 – 掃描歷史紀錄功能（2026-03-22）

**新功能：掃描歷史**

- **新增 `ScanHistoryModal` 元件**：點擊底部「📋 歷史」按鈕即可查看過去所有掃描記錄
  - 顯示掃描日期、資料夾路徑、門檻值、參考照數量、命中張數、花費時間
  - 每筆記錄最多顯示 5 張命中縮圖預覽
  - 新舊排序，最近的掃描顯示在最上方
- **自動儲存掃描 Session**：每次掃描完成後自動呼叫 `growth:save-session` IPC，將本次掃描摘要（含 top-5 縮圖）儲存至本機成長紀錄，不影響掃描效能（fire-and-forget）

**修復**

- **修正 `AIAnalysisPanel` 維度顯示錯誤**：「正在提取 1024 維臉部特徵向量」改為正確的「512 維」（ArcFace w600k_mbf 輸出 512-dim）

---

### v0.2.21 – PhotoEnhancer Bug 修復 + 43 個新測試（2026-03-22）

**修復 `src/core/photoEnhancer.ts` 的 NaN Bug**

- `enhancePhoto` 中 `const { mean, stdev } = await sharp().stats()` 取頂層欄位，但 Sharp v0.33+ 只在 `stats.channels[n]` 提供 `mean`/`stdev`。修復為取各通道平均值，確保亮度/對比度調整邏輯正確執行而非靜默跳過。

**新增 43 個測試（累計 176 個，15 個測試檔）**

- **`tests/unit/core/photoEnhancer.test.ts`（14 個測試）**
- **`tests/unit/utils/pathValidator.test.ts`（29 個測試）**

---

### v0.2.20 – 測試覆蓋大幅提升 + ChildQualityAssessor 數值 Bug 修復（2026-03-22）

**新增測試（27 個，合計 133 個）**

- **新增 `src/core/align.test.ts`（18 個測試）**
- **新增 `tests/unit/core/qualityAssessment.test.ts`（9 個測試）**

**修復 `src/core/childQualityAssessment.ts` 中的數值 Bug**

- **`estimateExposure` NaN Bug** 修復
- **`estimateSmoothness` 溢出 Bug** 修復

---

### v0.2.19 – 人臉對齊核心修復與 EXIF Orientation 支援（2026-03-21）

**關鍵修復：人臉對齊完全失效問題**

- **修復 `src/core/align.ts` - Umeyama 矩陣計算錯誤**：
  - 原 SVD 實作產生錯誤的相似變換矩陣，導致對齊後的 112×112 影像並非人臉而是背景
  - 重寫為線性最小二乘法（Linear Least Squares）計算仿射變換，誤差從 7-10px 降至 ~1.68px
  - 新增完整的逆矩陣計算和雙線性插值（Bilinear Interpolation）實作

- **修復 `src/core/align.ts` - EXIF Orientation 座標轉換**：
  - 新增 `transformKpsForOrientation()` 函數，完整支援 8 種 EXIF orientation（1-8）
  - 修復 iPhone 照片（orientation=6，逆時針 90°）導致的 KPS 座標與影像錯位問題
  - `alignFace()` 現在接受 `exifOrientation` 參數，確保 KPS 座標與 raw buffer 正確對齊

- **修復 `src/core/scrfd.ts` - 座標空間一致性**：
  - 偵測時使用 `.withMetadata({ orientation: undefined })` 禁用自動旋轉
  - `SCRFDFace` 介面新增 `orientation` 欄位，保存原始 EXIF orientation 供後續對齊使用
  - 確保整個 pipeline 使用統一的「原始像素空間」

- **修復 `src/core/detector.ts` - 傳遞 orientation 參數**：
  - 讀取影像時禁用自動旋轉，保持與 SCRFD 一致的座標空間
  - 正確傳遞 `exifOrientation` 給 `alignFace()`

**效能優化**

- **新增大圖預裁切機制**：圖片超過 4MP（400萬像素）時，先以關鍵點 bounding box + 50% padding 裁切臉部區域，再執行仿射對齊
  - 避免 Sharp affine 在超大圖片上拋出 "Input image exceeds pixel limit" 錯誤
  - 減少記憶體使用，提升處理速度

**測試與驗證**

- ✅ KPS 關鍵點視覺化驗證通過（5 個點正確對應五官位置）
- ✅ Umeyama 矩陣數值驗證通過（forward/inverse transform 正確）
- ✅ EXIF orientation 座標轉換單元測試通過（orientation 1-8）
- ✅ Build 通過，TypeScript 類型檢查通過

---

### v0.2.15 – 修復更新簽名驗證錯誤（2026-03-21）

- **移除 `publisherName`**：刪除 `"Local Developer"` 設定，electron-updater 不再嘗試驗證未簽署的安裝檔，修復「not signed by the application owner」錯誤。

### v0.2.14 – 自動更新安裝機制修復（2026-03-21）

- **根本原因修復**：`autoInstallOnAppQuit` 從 `false` 改為 `true`，啟用 electron-updater 內建的關閉自動安裝機制。
- **Main process 狀態優先級保護**：`sendUpdateStatus` 新增與 renderer 相同的優先級邏輯，防止 `downloaded` 狀態被 `checking`/`not-available` 覆蓋。
- **`updateDownloadedFlag` 安全旗標**：新增獨立布林旗標，一旦 `update-downloaded` 觸發就永不重置，確保 `before-quit` 一定能觸發安裝。
- **消除 `checkForUpdate` 競態**：renderer mount 時若已是 `downloaded` 狀態則跳過 `checkForUpdate`，避免重複呼叫導致狀態重置。

### v0.2.13 – 暗色主題 UI 修復（2026-03-21）

- **ResultsSection 暗色主題修復**：文字顏色從深色（neutral[700]）改為淺色（neutral[200]/[300]），邊框從黑色半透明改為白色半透明，按鈕顏色改為高亮度變體。
- **TaskReadinessCard 暗色主題修復**：標題與標籤文字改為淺色，狀態指示色改為亮色調。

### v0.2.12 – 自動更新流程修復 + 說明頁更新（2026-03-21）

- **自動更新 race condition 修復**：移除重複的 `checkForUpdates` 呼叫，防止下載進度到 100% 後橫幅消失。
- **更新狀態降級保護**：下載中或已下載狀態不再被 `checking`/`not-available` 事件覆蓋。
- **下載錯誤顯示**：更新下載失敗時顯示錯誤訊息與重試按鈕，不再靜默隱藏。
- **說明頁更新紀錄**：「近期更新」從舊版 v0.1.x 更新為最新版本紀錄。

### v0.2.11 – GPU 加速 + 自動更新修復（2026-03-21）

- **GPU 自動加速**：ONNX 推論自動偵測 GPU（Windows DirectML / Linux CUDA / macOS CoreML），有 GPU 就用 GPU，沒有則自動回退 CPU。AI 狀態標籤會顯示目前使用的加速器。
- **自動更新修復**：CI Release 現在正確上傳 `latest.yml`，`electron-updater` 可正常偵測新版本。
- **檢查更新按鈕改善**：點擊「檢查更新」後會顯示「檢查中…」/「已是最新」/「檢查失敗」狀態反饋。

### v0.2.10 – 批次掃描效能修復 + HEIC 支援（2026-03-21）

- **HEIC/HEIF 掃描支援**：修復 `listImagesRecursively` 缺少 `.heic`/`.heif` 副檔名，iPhone 照片在資料夾掃描時被忽略。
- **批次掃描效能優化**：`embed:batch` 改為 `retryOnNoFace: false`，非人臉照片不再重試 5 次，掃描速度提升約 5–7 倍。
- **批次掃描逾時保護**：每張照片加入 60 秒 per-file timeout，單張卡住不會阻塞整個掃描。
- **ArcFace 提取上限**：每張照片最多提取 20 張臉的 embedding，防止 SCRFD 在截圖/純色圖片產生大量假陽性時導致極端卡頓。
- **runMatch strategy 修復**：修復 `preload` 層 `runMatch` 缺少 `strategy` 參數傳遞，多參考照策略（best/average/weighted）現可正常運作。

### v0.2.9 – 用戶旅程模擬修復 + 人臉對齊核心修復（2026-03-20）

- **人臉辨識核心修復（CRITICAL）**
  - 修復 `src/core/align.ts`：Sharp `.affine()` 自動擴展輸出畫布，導致後續 `.resize(112,112)` 將整張大圖壓縮至 20×20px 而非擷取正確臉部區域。現改為計算 libvips auto-shift（正向變換輸入角點）後以 `.extract(shiftX, shiftY, 112, 112)` 取出正確位置，確保 ArcFace 收到真正的 112×112 對齊臉部。
  - 修復 `src/core/scrfd.ts`：SCRFD anchor 中心點誤用 `col*stride`（左上角）而非 `(col+0.5)*stride`（中心點），導致 5-point keypoint 偏移 4–16px，降低 Umeyama 對齊品質。
  - 修復 `src/main/index.ts`：參考照全部人臉偵測失敗但模型健康時，仍允許以 SHA-256 deterministic embedding 繼續掃描，產生無意義的相似度分數。現改為回傳明確錯誤，要求使用者提供更清晰的參考照。
  - 修復 `dimensionAdjustedCount` 重複計數問題（原每張照片 × 參考照數量，現正確為每張照片計一次）。

- **快取版本升級**
  - `src/core/db.ts`：`CURRENT_CACHE_VERSION` 從 3 升至 4，首次啟動後自動清除舊版（錯誤對齊產生的垃圾 embedding）並重建。
  - 新增 `getFacesByPath()` 512-dim 維度驗證，靜默跳過維度不符的過時快取項目。

- **用戶旅程模擬 — 10 個產品級 Bug 修復**
  - **文件選擇**：修復 `dialog:open-files` IPC 缺少 HEIC/HEIF/BMP 格式，iPhone 用戶無法直接選取照片。
  - **空資料夾掃描**：修復空資料夾掃描後 UI 永久停留在「掃描中...」狀態（缺少 `scan:progress` 完成事件）。
  - **進度條除以零**：修復 `ModernProgress` 在 `max=0` 時顯示 100% 的問題。
  - **匯出部分成功**：修復部分匯出成功時錯誤回報為「完全失敗」。
  - **匯出重試**：修復完整成功後重試仍重新匯出所有已成功檔案的問題。
  - **拖放非圖片**：修復非圖片檔案拖放時靜默丟棄無任何提示的問題，現顯示明確提示訊息。
  - **ImagePreview 縮放**：修復縮放時未鎖定背景滾動且不支援 ESC 關閉。
  - **CJK 輸入法衝突**：修復使用中文/日文輸入法時鍵盤快捷鍵（Ctrl+S 等）誤觸發的問題。
  - **localStorage QuotaExceededError**：新增 `src/utils/safe-storage.ts`，localStorage 寫入失敗時靜默降級而非拋出未處理例外。
  - **參考照超時計時器洩漏**：修復 `embed:references` 300 秒超時計時器在成功完成後未清除，導致計時器洩漏。

### v0.2.9 – 安全性與穩定性全面修復（2026-03-19）

- **打包修復**
  - 修復 `onnxruntime-common` 未加入 `asarUnpack`，導致打包安裝後 AI 模型載入失敗（`Cannot find module 'onnxruntime-common'`）。
  - 參考照 embedding 超時從 60 秒提升至 300 秒，適應高畫質大圖處理需求。

- **高解析度圖片修復**
  - 修復 `src/core/align.ts`：Sharp `.affine()` 在高像素圖片（>4MP）上拋出 `Input image exceeds pixel limit`，導致臉部對齊失敗、所有 5 次重試超時。
  - 新增預裁切機制：圖片超過 4MP 時，先以關鍵點 bounding box + 50% padding 裁切臉部區域，再執行仿射對齊，避免超出 Sharp 像素限制。
  - 典型案例：手機拍攝的 6000×4000 JPG（24MP），即使壓縮後只有 4.4MB，像素數仍超過 Sharp affine 上限。

- **安全性修復**
  - 新增 `src/utils/path-validator.ts`：路徑驗證模組，防止路徑遍歷攻擊
  - 強化 `src/core/db.ts`：所有資料庫操作加入路徑驗證，確保只有合法路徑才能寫入
  - 修復 `folder:open` IPC：加入路徑驗證和危險檔案類型檢查（禁止執行 .exe/.bat 等）
  - 參數驗證：`match:run` 加入 threshold (0-1) 和 topN (1-1000) 範圍驗證

- **穩定性修復**
  - 新增 `src/main/scanController.ts`：掃描狀態管理器，解決競態條件問題
  - 修復 `src/preload/index.ts`：事件監聽器使用 Set 管理，避免 `removeAllListeners` 洩漏
  - 修復 `src/core/embeddings.ts`：Promise.race timeout 清理機制，防止內存洩漏
  - 資料庫事務：新增 `withTransaction()` 和 `upsertPhotoAndFace()` 確保資料一致性
  - 掃描取消：在批次處理和錯誤處理中加入 `scanCancelled` 檢查

- **類型安全**
  - `src/core/db.ts`：移除 `any` 類型，使用具體類型定義
  - 統一錯誤處理：所有 `catch (err: any)` 改為 `catch (err)` 並正確轉換類型

- **測試與建置**
  - 10 個測試文件全部通過（93 個測試）
  - TypeScript 類型檢查通過
  - Lint 檢查通過

### v0.2.8 – 還原完整 InsightFace Pipeline（2026-03-18）

- **偵測引擎：SSD MobileNet → SCRFD det_500m**
  - 以 InsightFace SCRFD-500MF（`det_500m.onnx`，2.5 MB）取代 `@vladmandic/face-api` SSD MobileNet。
  - SCRFD 專為小臉、側臉設計，偵測精度顯著優於 SSD MobileNet，尤其對於兒童照片與非正面角度。
  - 新增 `src/core/scrfd.ts`：ONNX 推論、anchor 生成、distance-based bbox 解碼、5-point keypoint 解碼、IoU NMS。
  - 移除 `@vladmandic/face-api`、TensorFlow.js WASM backend、canvas npm 套件依賴。

- **臉部對齊：新增 Umeyama 5-point Similarity Transform**
  - 新增 `src/core/align.ts`：以 SCRFD 偵測的 5 個特徵點（左眼、右眼、鼻尖、左右嘴角）計算 Umeyama 相似變換，將臉部對齊至 ArcFace 標準 112×112 空間。
  - 對齊是 ArcFace 準確率的關鍵——模型訓練時全部使用標準化對齊圖片，未對齊的裁切（尤其側臉、仰頭）會顯著降低辨識精度。
  - 實作解析法 2×2 SVD + 防反射修正（Umeyama 1991），使用 Sharp `.affine()` 逆映射 + 雙三次插值。

- **識別引擎：確立 ArcFace w600k_mbf（512 維）**
  - 新增 `src/core/arcface.ts` 的 `extractArcFaceEmbeddingFromAligned()`：直接接受已對齊的 112×112 raw RGB buffer，不再做 crop/resize。
  - Embedding 維度從 1024（`@vladmandic/human` FaceRes）正式確立為 **512**（InsightFace ArcFace）。
  - Pipeline 等同 Python `insightface.app.FaceAnalysis.get()`。

- **模型檔案**
  - 新增 `models/insightface/det_500m.onnx`（2.5 MB）納入 repo。
  - `models/insightface/w600k_mbf.onnx`（13 MB）已存在，維持不變。
  - `scripts/download-models.mjs` 更新為同時下載/解壓兩個模型。

- **快取相容性**
  - 舊版（v0.2.7 以前）的 1024-dim embedding 快取與新 512-dim 不相容，首次執行時自動失效並重新計算。

- **測試**
  - 全部 96 個單元測試通過，`npm run typecheck` 通過。

- **已知行為（2026-03-18 實測記錄）**
  - 若參考照在人臉偵測階段（SCRFD）長時間無回應，會在約 30 秒後觸發 `FACE_DETECTION_TIMEOUT`，該張照片改用 deterministic embedding（檔案雜湊，非人臉特徵），流程仍會繼續跑完。
  - 當所有參考照皆因超時或偵測失敗而降級為 deterministic embedding 時，目前版本會視為模型引擎不健康，阻擋後續掃描並記錄：`⚠️ 4/4 reference photos used DETERMINISTIC embedding`、`⚠️ NO reference photos had faces detected`、`❌ Blocking scan because model engine is not healthy.`。
  - 實務上這會讓「全部難判斷的參考照」看起來像「載入失敗」，後續版本需評估是否改為允許在明確提示精準度風險的前提下繼續使用 deterministic 模式。

### v0.2.2 – 模型偵測穩定性與流程一致性修復（2026-03-17）

- **模型掃描主流程**
  - `embed:batch` 改為與 `embed:references` 一致：模型未就緒時先重試 `preloadModel()`，降低誤判「模型壞掉」。
  - 每次新掃描都重建記憶體 embedding 索引，避免混入前一次資料夾結果造成比對污染。

- **快取與比對一致性**
  - SQLite `faces` 新增 `source` 欄位（含舊資料自動 migration），保存 `face/deterministic/unknown` 來源。
  - 讀取快取時保留來源，讓 deterministic 懲罰邏輯在重啟後仍一致。

- **參考照流程與 UI**
  - 參考照變更（拖放/重選）時自動重置 `refsLoaded`，避免 UI 與實際 embedding 不一致。
  - 參考區顯示「已選 N / 已載入 M」，並加入參考照縮圖預覽，方便快速檢查選圖是否正確。
  - 訊息語義分流：成功/警告/資訊/錯誤改為不同提示色，減少誤導。

- **測試**
  - 新增 `db` 單元測試：驗證 embedding `source` roundtrip 與舊 schema migration。
  - 擴充 `useScanState` 測試：驗證拖放新參考照時會重置已載入狀態。
  - 全部單元測試通過（`96 passed`），`npm run build` 通過。

### v0.2.1 – 上線品質強化（2026-03-13）

- **生產品質改善**
  - 主進程日誌統一：`secureStore` 和 `growthRecordManager` 的 `console.error` 遷移至集中式 logger，方便追蹤線上問題。
  - Preload IPC bridge 型別安全：6 處 `any` 替換為具體 TypeScript 介面。
  - LoadingSpinner 加入 ARIA 無障礙屬性（`role="status"`、`aria-label`）。
  - ScanControls 暫停/取消掃描加入 try/catch 錯誤處理，避免 IPC 失敗時 UI 卡住。

- **CI/CD 修復**
  - 修復 GitHub Actions Release step 因 asset 已存在而失敗的問題。

### v0.1.0 – 可安心上線版（2026-03-10）

- **核心功能**
  - 本機離線 AI 臉部比對，從大量班級 / 活動照片中找出與參考照相符的小孩照片。
  - 支援多種圖片格式（JPG / PNG / GIF / BMP / WEBP / HEIC / HEIF）。
  - 使用 `@vladmandic/human` 建立臉部嵌入；以 SQLite (`better-sqlite3`) 快取 embedding 與縮圖，重新掃描大幅加速。
  - 以 `sharp` 產生縮圖與進行畫質處理，避免直接載入大檔造成當機。

- **桌面應用與打包**
  - 使用 Electron + React + TypeScript + Vite 建立 Windows 桌面應用。
  - 新增 `electron-builder` 設定與 `npm run release:win` / `dist:win` 腳本，可一鍵產生 Windows 安裝檔（`Find My Kid-0.1.0-Setup.exe`）。
  - 設定正式產品名稱 `Find My Kid`、應用程式圖示 `resources/logo.ico`，並在主視窗標題列與安裝捷徑中顯示。
  - 修正打包後路徑問題：主程序改用 `app.getAppPath()` + 相對路徑載入 `dist/preload/index.cjs` 與 `dist/renderer/index.html`，並在 Vite 設定 `base: './'` 以避免打包成絕對 `/assets/...` 導致白屏。

- **UI / UX（家長友善）**
  - 新版主畫面：
    - Header：Logo、標題「Find My Kid」、副標「從大量照片中找出與參考照片相符的小孩照片」、處理狀態徽章、說明 / 版本按鈕。
    - 「爸媽常用快速入口」：一鍵載入上次設定、快速回到上次使用的照片資料夾、一鍵開始搜尋。
    - Step 1：拖放式參考照片區（建議 3–10 張清晰小孩臉）。
    - Step 2：拖放式班級 / 活動照片資料夾區。
    - Step 3：相似度門檻 Slider + Top-N 結果數量設定，附中文解說與色條強度視覺化。
  - 未找到結果時，提供三個「再試一次」行動：
    - 再試一次：先放寬門檻。
    - 加參考照再重掃（自動捲動回參考照輸入區並提示補照）。
    - 切到「待複核」檢視結果。
  - 匯出流程：
    - 匯出前預覽清單（最多顯示前 50 張，其餘以數量提示）。
    - 支援「全部結果 / 僅收藏 / 僅待複核」三種匯出模式。
    - 匯出完成視窗顯示輸出資料夾、成功 / 失敗張數與錯誤說明，並可「只重試失敗項目」。
    - 新增「匯出完成後直接打開輸出資料夾」選項與「一鍵複製結果到手機」按鈕，方便家長將結果帶到手機瀏覽。

- **Onboarding 與文案**
  - Onboarding Wizard 增加「安心提示」文字（`reassurance`），降低首次使用者焦慮，例如：「不用怕，第一次上手照步驟走完就能看到結果，不用一次就做到完美。」
  - 所有主要 UI 文案改為繁體中文，語氣以「對爸媽說話」為優先。

- **成長紀錄與記錄管理（本機 JSON）**
  - 新增 `growthRecordManager` 與對應 IPC API，將每次搜尋結果紀錄成本機 JSON 檔案（不上傳）。
  - 支援：
    - 成長紀錄：記錄孩子姓名、照片集合名稱、掃描次數、命中照片數與月度統計。
    - 掃描工作階段：儲存每次搜尋的設定（門檻、Top-N、結果清單與時間）。
    - 提醒：長時間未掃描時提醒爸媽「孩子又長大了」。
    - 家庭成員與共享相簿：基礎結構已就緒（預留之後擴充成簡易家庭相簿）。

- **照片品質與加強**
  - 新增 `ChildQualityAssessor`：評估照片清晰度、對比、曝光、雜訊、解析度與臉部清晰度，回傳建議文字（例如：建議多拍光線正面的照片）。
  - 新增 `photoEnhancer`：可將畫質較差的照片輸出為「加強版」供匯出使用。

- **效能與穩定性**
  - `performanceManager`：將大量照片嵌入任務分批處理，控制並行數，避免一次吃爆記憶體。
  - `TaskQueueManager`：提供任務佇列與進度事件，為未來多批次掃描與背景處理預留空間。
  - 修正 Windows 打包後 Electron 安裝損壞問題（重新安裝 `electron`、排除 bundle 內 `electron` 依賴）。

- **發佈與文件**
  - `CHANGELOG.md` 建立，記錄版本變更。
  - `README.md` 新增「上線流程（先做 .exe）」與簽章說明：
    - `npm run release:check`
    - `npm run release:win`
    - `npm run release:check-sign` / `npm run release:win:with-sign`（有憑證時用於正式簽章）。
  - 新增 `app:about` IPC 與前端版本資訊 / 支援頁（說明視窗顯示目前版本、更新摘要與客服信箱 `support@findmykid.app`）。
