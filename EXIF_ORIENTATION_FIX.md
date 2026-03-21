# EXIF Orientation 座標錯位修復

## 問題描述

帶有 EXIF orientation（如 orientation=6，逆時針 90 度）的照片在臉部對齊時出現座標錯位：

- KPS 座標對應原始像素空間（寬 5712，高 4284）
- 但 alignFace 輸出的是背景/衣服而非人臉

## 根本原因

Sharp 預設會自動應用 EXIF orientation 旋轉圖片，但：

1. `metadata()` 回傳的 `width/height` 仍是原始尺寸
2. SCRFD 偵測時使用的 scale 計算錯誤，導致 KPS 座標映射錯誤
3. 整個 pipeline 的座標空間不一致

## 修復方案

### 1. 統一座標空間（scrfd.ts, detector.ts）

在整個 pipeline 中禁用自動旋轉，保持原始像素空間：

```typescript
// 禁用自動旋轉，保持原始像素空間
sharp(imagePath).withMetadata({ orientation: undefined });
```

### 2. 座標轉換（align.ts）

新增 `transformKpsForOrientation` 函數，根據 EXIF orientation 調整 KPS 座標：

```typescript
function transformKpsForOrientation(
  kps: [number, number][],
  orientation: number,
  width: number,
  height: number
): [number, number][] {
  // 根據 EXIF orientation 1-8 轉換座標
  // 確保 KPS 與未旋轉的 raw buffer 對齊
}
```

### 3. 傳遞 Orientation 資訊

- `SCRFDFace` 接口新增 `orientation` 欄位
- `alignFace` 函數新增 `exifOrientation` 參數
- `detector.ts` 讀取並傳遞 EXIF orientation

## 修改檔案

1. **src/core/scrfd.ts**
   - 禁用自動旋轉
   - 在 SCRFDFace 中添加 orientation 欄位
   - 在偵測結果中包含 orientation

2. **src/core/detector.ts**
   - 禁用自動旋轉
   - 讀取 EXIF orientation
   - 傳遞 orientation 給 alignFace

3. **src/core/align.ts**
   - 新增 transformKpsForOrientation 函數
   - 修改 alignFace 接受 orientation 參數
   - 在函數開始時轉換 KPS 座標

## 測試

運行測試腳本：

```bash
npx tsx test-exif-fix.ts <path-to-image-with-exif-orientation>
```

或使用單元測試：

```bash
npx tsx test-exif-orientation.ts
```

## 驗證結果

- 座標轉換邏輯經過單元測試驗證（所有 8 種 orientation）
- Build 成功，無編譯錯誤
- 與現有程式碼向後相容（預設 orientation=1，無轉換）
