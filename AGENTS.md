## Find My Kid (Offline) Cursor Agents 規範

這個專案是給家長直接安裝使用的桌面工具，目標是讓爸媽在大量照片中，快速且安心地找出自己小孩的照片。  
以下規範用於後續所有 Cursor / Agent 協作，請直接遵循，不另行協商。

### 專案定位與核心原則

- 離線優先：所有 AI 運算都在本機完成，不得上傳使用者照片或臉部資料。
- 家長導向：UI 與文案使用繁體中文，語氣友善、安心，避免工程術語和嚇人的字眼。
- 安全優先：比華麗功能更重要的是「可安心使用」與穩定性。
- 可維運優先：能快速交付、容易回溯與維修，優先保留簡潔可讀的實作。

### 專案結構（高頻關係）

- 主程式 / 打包
  - `src/main/index.ts`：Electron 主程序、視窗建立、IPC、路徑、啟動資訊。
  - `src/preload/index.ts`：`window.api` 安全橋接，僅露出必要 IPC。
  - `package.json`：Windows 打包腳本與 `electron-builder` 設定。
  - `vite.renderer.config.ts`：前端打包入口（`base: './'` 為關鍵設定）。
- Renderer（React）
  - `src/renderer/App.tsx`：主要流程主畫面。
  - `src/renderer/components/*`：共用 UI 與流程元件。
  - `src/renderer/styles/theme.ts`：視覺主題與色彩系統（想改風格先改此檔）。
- Core / Domain
  - `src/core/embeddings.ts`、`src/core/similarity.ts`：比對核心邏輯。
  - `src/core/db.ts`、`src/core/thumbs.ts`：快取與縮圖管理。
  - `src/core/performance.ts`：批次與資源控管。
  - `src/main/growthRecordManager.ts`：掃描歷史與成長紀錄儲存（本機）。
  - `src/core/childQualityAssessment.ts`、`src/core/photoEnhancer.ts`：照片品質與品質加強。

### UI / UX Agent 指引（強制）

- 語氣與文案
  - 一律使用繁體中文，句子短、清楚、溫和。
  - 像跟爸媽說話，優先「可以先試一次、再微調」的陪伴感。
- 視覺
  - 以柔和淺色調為主，避免大型霓虹或高刺激色塊。
  - 主要按鈕要一眼可辨識、對比明確，不刺眼。
- 流程保留
  - 保持「三步驟」主流程：參考照 → 照片資料夾 → 門檻與數量。
  - 快速入口需保留，按鈕附近加簡短提示（例：建議先載入參考照再開始掃描）。
- 介面變更限制
  - 不得重寫導覽核心邏輯與狀態管理，除非需求明確要求。
  - 允許調整文案、文案順序、視覺排版，但要維持原有使用路徑一致。

### 後端 / 效能 / 打包 Agent 指引

- 修改主程序、preload、打包流程時，必須先確認：
  - `src/main/index.ts` 的 `getAppRoot()` 邏輯不受破壞（打包後以 `app.getAppPath()` 為準）。
  - `preload` 與 `index.html` 仍指向 `dist/...` 資源路徑。
  - 不要修改 `node_modules` 檔案，透過設定、封裝或 wrapper 解決。
- 變更打包設定後至少執行一次：
  - `npm run build`
  - `npm run dist:win` 或 `npm run release:win`
- 發佈簽章
  - 正式版測試建議順序：`npm run release:check-sign` → `npm run release:win:with-sign`。
  - 無簽章憑證時允許先用 `release:win` 做驗證版。

### 測試與穩定性 Agent 指引

- 開發修改至少保證：
  - `npm run build` 可通過。
  - `npm run start` 可啟動並正常顯示畫面。
- 改核心邏輯時優先補 `vitest` 測試，聚焦關鍵路徑，不以高覆蓋率為目標。
- 有風險高的流程（檔案輸入、模型載入、快取寫入）要先做回歸思考，避免破壞既有操作流程。

### Stitch MCP 使用規範

- MCP：`user-stitch`
- 建議流程
  - 有新版面概念先 `create_project`（title 含 Find My Kid）。
  - 使用 `generate_screen_from_text` 產生概念稿後，先在瀏覽器確認再實作。
  - 如需修正，改用 `edit_screens`，由文字描述指定調整重點。
- 邊界條件
  - 只轉換「結構與樣式」，不得改 IPC 名稱、資料欄位、核心流程邏輯。
  - 任何從 HTML 來的成果，皆需轉為 `App.tsx` 與 `theme.ts` 可維護的實作，不可直接貼整頁進專案。

### Do / Don't

- Do
  - 先理解既有流程再改 UI 或核心邏輯。
  - 用小步驟提交，保留可回滾空間。
  - 明確標示修改目的與預期影響。
- Don't
  - 不改壞 `dist` 路徑、IPC 契約或核心資料流程。
  - 不在未經確認下全面重構 `src/main/*` 與 `src/renderer/App.tsx`。
  - 不新增會讓隱私風險上升的上傳或遠端呼叫行為。

### 變更前後檢核清單

- 事前
  - 確認任務是否改動 UI、核心、或打包邏輯，並選對對應 Agent 流程。
  - 確認是否涉及檔案路徑、IPC、或打包流程的敏感區域。
- 事後
  - 檢查三步驟流程與快速入口是否仍可操作。
  - 再次確認 build / start 的基本可用性條件成立。
  - 檢視文案是否仍為繁中且對家長友善。

