## Changelog - Find My Kid (Offline)

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

