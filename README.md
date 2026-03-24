# 大海撈Ｂ (Find My Kid) — 小孩照片篩選工具

**版本：0.3.0**

一個離線、隱私優先的 Windows 桌面應用程式，使用 AI 臉部識別技術從大量照片中找出與指定小孩相符的照片。所有處理皆在本機進行，不會上傳任何照片或特徵向量至雲端。

---

## 特色

- 🔒 **完全離線**：所有 AI 推論在本機執行，零雲端上傳
- 🎯 **高準確度**：InsightFace SCRFD + ArcFace（ONNX）臉部偵測 + Umeyama 對齊 + 512 維特徵向量
- ⚡ **快速處理**：SQLite 快取（含縮圖），大幅提升重複掃描速度
- ⏸️ **掃描控制**：支援暫停、繼續、取消掃描
- 🖼️ **縮圖預覽**：虛擬捲動結果列表，顯示縮圖與相似度分數
- 📈 **成長記錄**：記錄小孩成長里程碑與掃描會話
- 🔍 **參考照片品質評估**：自動評估參考照片品質並提供建議
- 🌙 **生態模式**：低資源消耗的批次處理模式
- 🛡️ **安全性**：路徑驗證防止路徑遍歷攻擊，GDPR 資料匯出支援

---

## 系統需求

- **作業系統**：Windows 10/11（64-bit）；亦支援 macOS、Linux
- **Node.js**：20+（開發環境，CI 測試 20.x 與 22.x）
- **RAM**：最少 4GB，建議 8GB（大量掃描時）
- **磁碟空間**：約 500MB（不含照片與快取）

---

## 支援的圖片格式

JPG、JPEG、PNG、GIF、BMP、WEBP、HEIC、HEIF

---

## 安裝

### 從原始碼建置

```bash
# 複製專案
git clone https://github.com/samulee003/child-picture-select.git
cd child-picture-select

# 安裝依賴
npm install

# 下載 ONNX 模型（det_500m.onnx + w600k_mbf.onnx）
npm run download-models

# 執行開發版本
npm run dev
```

### 打包 Windows 安裝程式

```bash
# 未簽章版本
npm run release:win

# 簽章版本（需設定 CSC_LINK 與 CSC_KEY_PASSWORD 環境變數）
npm run release:check-sign
npm run release:win:with-sign
```

安裝程式輸出至 `dist-electron/da-hai-lao-b-{版本}-Setup.exe`。

建議在正式發布前完成程式碼簽章，避免 Windows SmartScreen 警告。

---

## 使用說明

### 基本流程

1. **準備參考照片**
   - 準備 3–10 張包含目標小孩臉部的清晰照片
   - 建議使用不同角度、光線的照片以提高準確度

2. **上傳參考照片**
   - 拖曳照片至「參考照片」區域，或點擊選取
   - 系統自動評估照片品質並顯示建議

3. **選擇掃描資料夾**
   - 點擊「選擇資料夾」選取要搜尋的目標資料夾

4. **調整參數**（可選）
   - **門檻值**：相似度門檻（0–1），建議 0.4–0.7，數值越高越嚴格
   - **Top-N**：顯示前 N 個最相似的結果
   - **比對策略**：`best`（預設）、`average`、`weighted`

5. **執行掃描**
   - 點擊「開始掃描」，可隨時暫停或取消
   - 進度列即時顯示處理進度與預計剩餘時間

6. **檢視與審核結果**
   - 在結果列表中查看匹配照片、相似度分數與縮圖
   - 使用滑動審核介面快速標記保留 / 捨棄

7. **匯出結果**
   - 點擊「匯出」，照片將複製至指定資料夾

---

## 技術架構

### 核心技術棧

| 層級 | 技術 |
|------|------|
| 桌面框架 | Electron 31.5.0 |
| UI | React 18.3.1 + TypeScript 5.6.3 |
| 建置工具 | Vite 5.4.10 + tsup |
| AI/ML | InsightFace SCRFD det_500m + ArcFace w600k_mbf（onnxruntime-node 1.20.1） |
| 圖片處理 | Sharp 0.33.5 |
| 資料庫 | better-sqlite3 11.7.0（本地 SQLite） |
| 測試 | Vitest 2.1.4 + Playwright 1.48.2 |
| 打包 | electron-builder 25.1.8 + electron-updater 6.8.3 |
| 虛擬捲動 | react-window 2.2.7 |

### AI Pipeline

```
參考照片 / 目標照片
  → sharp 預處理
  → SCRFD det_500m（bbox + 5 關鍵點）
  → Umeyama 相似變換（112×112 對齊）
  → ArcFace w600k_mbf（512 維 L2 正規化特徵向量）
  → 餘弦相似度比對
```

- 若臉部偵測失敗，自動降級至 SHA-256 確定性特徵向量（相似度扣 0.12 分並標示警告）
- Pipeline 等同 Python `insightface.app.FaceAnalysis.get()`

### 快取策略

- SQLite 資料庫位於 `%APPDATA%/find-my-kid-offline/`（Windows）
- 特徵向量以檔案路徑 + mtime 為鍵，自動失效過期快取
- 記憶體 LRU 快取上限 50,000 筆（約 200MB）
- 縮圖快取於 `%APPDATA%/find-my-kid-offline/thumbs/`

### 批次處理

| 模式 | 批次大小 | 並行數 |
|------|----------|--------|
| 預設 | 50 張/批 | 4 |
| 生態模式 | 20 張/批 | 2 |

---

## 專案結構

```
/
├── src/
│   ├── core/              # AI 與圖片處理核心
│   │   ├── detector.ts        # 偵測協調（SCRFD → 對齊 → ArcFace）
│   │   ├── scrfd.ts           # SCRFD det_500m ONNX 偵測器
│   │   ├── align.ts           # Umeyama 5-point 對齊（112×112）
│   │   ├── arcface.ts         # ArcFace w600k_mbf ONNX 識別（512 維）
│   │   ├── embeddings.ts      # 特徵向量提取 + 確定性 fallback
│   │   ├── similarity.ts      # 餘弦相似度 + 多參考融合
│   │   ├── db.ts              # SQLite 快取（WAL 模式）
│   │   ├── thumbs.ts          # 縮圖生成（Sharp）
│   │   ├── childQualityAssessment.ts  # 照片品質評估
│   │   └── performance.ts     # 批次處理 + 記憶體管理
│   ├── main/              # Electron 主程序
│   │   ├── index.ts           # IPC 處理器與應用生命週期
│   │   ├── scanController.ts  # 掃描狀態管理（暫停/繼續/取消）
│   │   ├── growthRecordManager.ts  # 成長記錄與會話追蹤
│   │   └── secureStore.ts     # 安全本地儲存
│   ├── preload/
│   │   └── index.ts           # IPC 橋接（context isolation）
│   ├── renderer/          # React UI
│   │   ├── App.tsx
│   │   ├── components/        # 27 個 React 元件
│   │   ├── hooks/             # 自訂 hooks
│   │   └── styles/theme.ts    # Glassmorphism 主題
│   ├── types/             # TypeScript 介面定義
│   └── utils/             # 工具模組（logger、path-validator 等）
├── tests/
│   ├── unit/              # Vitest 單元測試
│   └── e2e/               # Playwright E2E 測試
├── models/insightface/    # ONNX 模型（det_500m.onnx、w600k_mbf.onnx）
├── resources/             # 應用圖示與資源
└── scripts/               # 建置腳本
```

---

## 開發指南

### 常用指令

```bash
npm run dev           # 啟動完整開發環境（main + preload + renderer）
npm run dev:renderer  # 僅啟動 Vite 開發伺服器（:5173）
npm run typecheck     # TypeScript 型別檢查
npm run lint          # ESLint 自動修正
npm run lint:check    # ESLint 僅檢查
npm run format        # Prettier 格式化
npm run format:check  # Prettier 僅檢查
npm run build         # 完整建置
npm run clean         # 清除 dist/ 與 out/
```

### 執行測試

```bash
npm test              # 單元測試（Vitest）
npm run test:watch    # 監聽模式
npm run test:e2e      # E2E 測試（Playwright）
npm run test:coverage # 覆蓋率報告
```

### 提交前請執行

```bash
npm run typecheck
npm run lint:check
npm test
```

---

## 效能優化

- **SQLite 快取**：已處理的特徵向量快取，重複掃描大幅加速
- **縮圖快取**：縮圖預先生成並快取
- **批次並行**：預設 4 並行任務，生態模式降為 2
- **記憶體管控**：heap 超過 1GB 自動觸發 GC
- **虛擬捲動**：大量結果使用 react-window 虛擬化，避免 DOM 過載

---

## 常見問題

**Q：找不到匹配的照片？**
- 降低門檻值（例如從 0.6 降至 0.4）
- 增加參考照片數量（建議 5–10 張）
- 確保參考照片清晰且包含完整臉部

**Q：處理速度很慢？**
- 首次掃描較慢為正常現象，後續掃描會使用快取大幅加速
- 可切換至「生態模式」降低資源佔用

**Q：臉部偵測失敗？**
- 應用程式會自動降級至確定性特徵向量（基於檔案內容），不影響功能
- 若需真正的臉部偵測，請確認 `models/insightface/` 下的 ONNX 模型已正確下載（執行 `npm run download-models`）

**Q：打包後 AI 模型載入失敗？**
- 確認 `package.json` 的 `asarUnpack` 已包含 `onnxruntime-node` 與 `onnxruntime-common`

---

## 安全性與隱私

1. 所有 AI 推論在本機執行，不上傳任何照片或特徵向量
2. `shell:open-external` 僅允許 HTTPS 連結
3. 所有檔案路徑操作透過 `path-validator.ts` 驗證，防止路徑遍歷攻擊
4. Context isolation 於 preload 中啟用
5. 無任何使用統計或遙測
6. 支援 GDPR 資料匯出（`data:export-all`）與舊會話清除（`privacy:clear-old-sessions`）

---

## 更新日誌

### v0.2.9（2026-03-19）— 安全性與穩定性全面修復

- 修復打包後 `onnxruntime-common` 未加入 `asarUnpack` 導致 AI 模型載入失敗
- 修復 Sharp `.affine()` 在高像素圖片（>4MP）上失敗；新增預裁切機制
- 新增 `path-validator.ts` 防止路徑遍歷攻擊
- 新增 `scanController.ts` 解決掃描競態條件
- 參考照片 embedding 超時從 60 秒提升至 300 秒
- 資料庫新增 `withTransaction()` 與 `upsertPhotoAndFace()` 確保資料一致性
- 93 個單元測試全部通過

### v0.2.8（2026-03-18）— 還原完整 InsightFace Pipeline

- 偵測引擎從 SSD MobileNet 升級為 SCRFD det_500m
- 新增 Umeyama 5-point 臉部對齊（`align.ts`）
- Embedding 維度從 1024 確立為 512（ArcFace w600k_mbf）
- 移除 `@vladmandic/face-api`、TensorFlow.js WASM、canvas 依賴
- 舊版 1024-dim 快取自動失效

### v0.2.7 以前

詳見 [CHANGELOG.md](CHANGELOG.md)

---

## 授權

本專案為私人專案，僅供個人使用。
