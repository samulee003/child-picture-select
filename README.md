# Find My Kid (Offline) - 小孩照片篩選工具

一個離線、隱私優先的 Windows 桌面應用程式，使用 AI 臉部識別技術從大量照片中找出與指定小孩相符的照片。

## 特色

- 🔒 **完全離線**：所有處理都在本機進行，不會上傳任何照片到網路
- 🎯 **高準確度**：使用 `@vladmandic/human` 進行臉部偵測與特徵提取
- ⚡ **快速處理**：支援 SQLite 快取與縮圖快取，大幅提升重複掃描速度
- 📊 **進度追蹤**：即時顯示處理進度與目前處理的檔案
- 🖼️ **縮圖預覽**：結果列表顯示縮圖，方便快速檢視
- 🎨 **簡潔 UI**：直觀的介面設計，易於使用

## 系統需求

- Windows 10/11 (64-bit)
- Node.js 22+ (開發環境)
- 至少 4GB RAM
- 約 500MB 磁碟空間（不含照片）

## 安裝

### 從原始碼建置

1. 複製專案：
```bash
git clone <repository-url>
cd "AI 篩選照片"
```

2. 安裝依賴：
```bash
npm install
```

3. 建置專案：
```bash
npm run build
```

4. 執行開發版本：
```bash
npm run dev
```

### 打包應用程式

```bash
npm run dist
```

打包後的安裝程式會在 `dist-electron/` 目錄中。

### 上線流程（先做 .exe）

1. 確認 logo 檔案放在：
- `resources/logo.svg`
- `src/renderer/public/logo.svg`
2. 執行上線前檢查：
```bash
npm run release:check
```
3. 直接產生 Windows 安裝檔：
```bash
npm run release:win
```

4. 若為正式上架版，請先確認簽章憑證後執行：
```bash
npm run release:check-sign   # 檢查 CSC 環境變數是否齊全
npm run release:win:with-sign # 進行打包（環境有憑證才會進行簽章）
```
建議在正式發布前務必完成簽章，避免 Windows SmartScreen 提示。

安裝檔將產生在 `dist-electron/`，例如：
`Find My Kid-<版本>-Setup.exe`

若要上架/正式發佈，建議先更新 `package.json` 的 `version`、`appId` 與 `author`，再重打包。

### 上線後顯示版本與客服資訊

- 在主頁面右上角「版本」按鈕點擊可查看版本號、近期更新日誌與客服信箱
- 目前預設客服信箱：`support@findmykid.app`（可於主程序 `app:about` 回傳資料調整）

## 使用說明

### 基本流程

1. **準備參考照片**：
   - 準備 3-10 張包含目標小孩臉部的清晰照片
   - 建議使用不同角度、光線的照片以提高準確度

2. **輸入參考照片路徑**：
   - 在「小孩參考照片路徑」文字框中，每行輸入一張照片的完整路徑
   - 例如：
     ```
     C:\Photos\child\photo1.jpg
     C:\Photos\child\photo2.jpg
     C:\Photos\child\photo3.jpg
     ```

3. **嵌入參考臉部**：
   - 點擊「嵌入參考臉」按鈕
   - 等待處理完成（狀態顯示「refs ready」）

4. **選擇照片資料夾**：
   - 在「照片資料夾」輸入框中輸入要搜尋的資料夾路徑
   - 例如：`C:\Photos\Family\2024`

5. **調整參數**（可選）：
   - **門檻值**：相似度門檻（0-1），數值越高越嚴格
   - **Top-N**：顯示前 N 個最相似的結果

6. **執行掃描與比對**：
   - 點擊「掃描與比對」按鈕
   - 等待處理完成（會顯示進度條）

7. **檢視結果**：
   - 在「候選結果」區域檢視匹配的照片
   - 每張照片顯示相似度分數和縮圖

8. **匯出結果**：
   - 點擊「匯出結果」按鈕
   - 照片會複製到資料夾名稱加上 `_matched_export` 的目錄

## 技術架構

### 核心技術

- **Electron 31+**：跨平台桌面應用框架
- **React 18**：使用者介面
- **TypeScript**：型別安全的程式碼
- **@vladmandic/human**：臉部偵測與特徵提取
- **better-sqlite3**：本地快取資料庫
- **sharp**：圖片處理與縮圖生成

### 專案結構

```
├── src/
│   ├── core/           # 核心功能模組
│   │   ├── detector.ts        # 臉部偵測
│   │   ├── embeddings.ts       # 特徵向量提取
│   │   ├── similarity.ts      # 相似度計算
│   │   ├── db.ts              # SQLite 資料庫
│   │   └── thumbs.ts          # 縮圖生成
│   ├── main/           # Electron 主程序
│   │   └── index.ts
│   ├── preload/        # Preload 腳本
│   │   └── index.ts
│   └── renderer/       # 渲染程序（React UI）
│       ├── App.tsx
│       └── main.tsx
├── tests/              # 測試檔案
│   ├── e2e/           # 端到端測試
│   └── ...
└── package.json
```

## 開發指南

### 執行測試

```bash
# 單元測試
npm test

# E2E 測試
npm run test:e2e

# 監聽模式
npm run test:watch
```

### 型別檢查

```bash
npm run typecheck
```

### 清理建置檔案

```bash
npm run clean
```

## 效能優化

- **快取機制**：使用 SQLite 快取已處理的照片 embedding，避免重複計算
- **縮圖快取**：縮圖會快取在 `%APPDATA%/find-my-kid-offline/thumbs/`
- **批次處理**：大量照片時會分批處理，避免記憶體溢出

## 注意事項

1. **首次使用**：首次掃描大量照片可能需要較長時間，後續掃描會使用快取加速
2. **照片格式**：支援 JPG、JPEG、PNG 格式
3. **準確度**：
   - 參考照片品質越高，準確度越好
   - 建議使用清晰、正面、光線充足的照片
   - 門檻值可根據需求調整（建議 0.4-0.7）

## 常見問題

### Q: 找不到匹配的照片？

A: 嘗試以下方法：
- 降低門檻值（例如從 0.6 降到 0.4）
- 增加參考照片數量（建議 5-10 張）
- 確保參考照片清晰且包含完整臉部

### Q: 處理速度很慢？

A: 
- 首次掃描較慢是正常的
- 後續掃描會使用快取，速度會大幅提升
- 確保有足夠的磁碟空間供快取使用

### Q: 臉部偵測失敗？

A: 
- 應用程式會自動降級到 deterministic embedding（基於檔案內容）
- 這是正常的 fallback 機制，不會影響功能
- 如需真正的臉部偵測，請確保 `@vladmandic/human` 已正確安裝

## 授權

本專案為私人專案，僅供個人使用。

## 更新日誌

### v0.1.0 (MVP)
- 基本臉部偵測與比對功能
- SQLite 快取機制
- 縮圖顯示與進度追蹤
- 錯誤處理與使用者提示

## 貢獻

歡迎提出問題與建議！

