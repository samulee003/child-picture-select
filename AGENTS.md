## Cursor Agents 設定 – Find My Kid (Offline)

這個專案已經可以給「一般家長」直接安裝使用，以下是之後在 Cursor 內協作時，建議給各個 Agent 的工作方式。

### 專案角色與目標

- **產品定位**：離線、隱私優先的桌面工具，幫爸媽在一大堆班級 / 活動照片中，快速找出自己小孩的照片。
- **核心原則**
  - 所有 AI 計算都在本機完成，不上傳照片。
  - UI 語言以繁體中文為主，文案要像在跟爸媽說話。
  - 「可安心使用」優先，再追求進階功能。

### 專案結構與重點檔案

- 主程式 / 打包
  - `src/main/index.ts`：Electron 主程序入口，負責視窗建立、IPC、路徑處理與 app branding。
  - `src/preload/index.ts`：Expose `window.api`，僅允許安全 IPC。
  - `package.json`：
    - `scripts.release:win`、`scripts.dist:win`：Windows 打包流程。
    - `build` 區塊：`electron-builder` 設定（`icon`、`extraResources`、`nsis` 等）。
  - `vite.renderer.config.ts`：renderer 使用 `base: './'`，確保打包後不會白屏。

- Renderer（React）
  - `src/renderer/App.tsx`：主畫面與家長流程（快選入口、3 步驟流程、結果檢視、匯出）。
  - `src/renderer/components/*`：共用 UI（按鈕、卡片、Onboarding、MatchResultCard 等）。
  - `src/renderer/styles/theme.ts`：
    - `theme.colors` / `theme.gradients` / `modernStyles`：整體色彩與玻璃風格設定。
    - 如要換整體視覺，**優先改這裡**，再調整個別元件。

- Core / Domain
  - `src/core/embeddings.ts`、`similarity.ts`、`db.ts`、`thumbs.ts`：AI 與快取核心。
  - `src/core/performance.ts`：批次處理與資源控管。
  - `src/main/growthRecordManager.ts`：成長紀錄與掃描歷史（本機 JSON）。
  - `src/core/childQualityAssessment.ts`、`photoEnhancer.ts`：照片品質與加強。

### 對 Agent 的具體指引

#### 1. UI / UX 調整 Agent

- **語氣與文案**
  - 一律使用繁體中文。
  - 用「爸媽聽得懂」的語言，不要工程術語。
  - 避免嚇人的字眼，多使用「放心」「可以之後再調整」等安心理解。

- **配色與風格**
  - 背景：以柔和的淺色（淺灰、淡藍、淡綠）為主，避免大面積霓虹漸層。
  - 主要按鈕：清楚、高對比，但不要刺眼。
  - 如果使用 Stitch MCP：
    - 先用 `create_project` / `generate_screen_from_text` 做概念稿，再手動翻成 `App.tsx` + `theme.ts` 的實作。
    - 把產出的 HTML 當「視覺參考」，**不要直接整頁貼進 React**。

- **Layout 原則**
  - 優先保持「三步驟」結構不變：1 參考照 → 2 照片資料夾 → 3 門檻與數量。
  - 快速入口區（爸媽常用）要保留，並保持文字非常清楚。
  - 在行為按鈕附近，多給一行短提示（例如「建議先載入參考照再開始搜尋」）。

#### 2. 後端 / 效能 / 打包 Agent

- 修改主程序或打包相關檔案時：
  - 調整 `src/main/index.ts` 時，務必確認：
    - `getAppRoot()` 邏輯不被破壞（打包後依賴 `app.getAppPath()`）。
    - `preload` 與 `index.html` 的路徑仍然指向 `dist/...` 之下。
  - 變更打包設定後，建議至少執行：
    - `npm run build`
    - `npm run dist:win` 或 `npm run release:win`
  - 不要修改 `node_modules` 內的檔案；優先透過設定或 wrapper 修正。

- Windows 簽章
  - 正式對外版本請使用：
    - `npm run release:check-sign`
    - `npm run release:win:with-sign`
  - 如環境沒有憑證，允許只用 `release:win` 做測試版。

#### 3. 測試與穩定性 Agent

- 優先確保：
  - `npm run build` 可通過。
  - `npm run start` 在開發模式能啟動並顯示畫面。
  - 若修改核心邏輯，必要時補 `vitest` 單元測試，但**不要為了追求 100% coverage 而拖慢爸媽體驗改善**。

### Stitch MCP 使用備忘

- MCP server：`user-stitch`
- 典型流程：
  1. 如需全新設計概念，呼叫 `create_project` 建立專案（title 包含「Find My Kid」）。
  2. 使用 `generate_screen_from_text` 產生主畫面 / 結果畫面等變化。
  3. 若需要微調（例如改成更中性配色），以 `edit_screens` 搭配 `prompt` 做細部修正。
  4. 根據回傳的 `htmlCode.downloadUrl` 在瀏覽器中預覽，將合適的結構翻譯成 React + CSS-in-JS（或 inline style）。

- 任何從 Stitch 來的 UI 修改，最後都要：
  - 保持現有 React component 邏輯與狀態管理不被破壞。
  - 只替換結構和樣式，避免改變 IPC 呼叫 / 資料模型。

