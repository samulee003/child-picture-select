## Changelog - Find My Kid (Offline)

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
