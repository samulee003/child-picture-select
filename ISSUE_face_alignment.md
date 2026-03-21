# Bug: 人臉對齊 (alignFace) 輸出錯誤，導致比對完全失準

**狀態**: 未解決  
**嚴重程度**: Critical — 整個比對功能失效  
**記錄時間**: 2026-03-21

---

## 問題描述

應用程式扃描出來的「最相似」照片，完全不是目標小孩，甚至 100% 相似度都是錯誤的人。

根本原因：`src/core/align.ts` 的 `alignFace()` 函式輸出錯誤——對齊後的 112×112 影像並不是人臉，而是背景或其他區域。

---

## 已確認的事實

### 1. SCRFD 偵測正常
- `detectFacesSCRFD()` 使用 `det_500m.onnx` 模型，可正確偵測到臉部
- 輸出的 `bbox` 和 `kps`（5 個關鍵點）座標是正確的
- 但 **偵測時使用 maxSize=2048 縮圖**，座標已自動映射回原始圖片空間

### 2. 座標空間一致性
- `scrfd.ts` 中：`sharp(imagePath)` **不加** `.rotate()`，偵測在 EXIF 未旋轉的空間進行
- `detector.ts` 中：讀取 raw buffer 時也 **不加** `.rotate()`
- 所以 KPS 座標對應的是 **未旋轉的原始像素空間**
- ⚠️ 若測試腳本呼叫 `sharp(imgPath).rotate()` 讀取 raw buffer，座標空間會不一致（EXIF orientation=6 時 width/height 會互換）

### 3. Sharp `affine()` API 的根本問題
Sharp 的 `.affine()` API **無法強制輸出固定 112×112 的 canvas**：
- 它永遠把輸出 canvas 設為「所有輸入角落的 forward transform 覆蓋範圍」
- 當 Umeyama scale < 1（人臉 > 112px，需要縮小對齊），輸出 canvas 會小於 112px
- 例如：affineOut = `81×77`，根本無法從中截取 112×112

### 4. 已嘗試的修法（均失敗）
1. **Forward matrix + odx/ody**: 大圖的 odx/ody 達到數百像素，libvips canvas 管理和偏移量相互疊加導致輸出黑圖
2. **先裁切臉部區域，再做 forward affine + 計算 shift 後 extract**: affineOut 仍然 < 112px
3. **Forward 2×2 + idx/idy 作為 inverse translation**: 同樣 affineOut < 112px

### 5. 最新嘗試（Pure JS Bilinear Warp）— 邏輯正確，但結果仍然錯誤

目前 `align.ts` 已改為純 JS 雙線性插值重映射（不再使用 Sharp affine）：

```typescript
// For each output pixel (ox, oy) in 112×112:
//   source = M_inv * [ox, oy] + inv_translation
//   bilinear interpolate from srcBuffer
```

輸出不再是全黑，平均亮度 86~120，但視覺上仍然是「背景」而非人臉。

---

## 懷疑的剩餘問題

測試照片的 **KPS 關鍵點本身就指向錯誤位置**，或是 Umeyama 矩陣計算有誤。

### 具體診斷數據（`test-verify-math.cjs` 輸出）

```
=== 84%_85%_IMG_7467 (5712x4284) ===
KPS: (819,576)  (957,575)  (888,648)  (838,707)  (945,706)
ARC: (38,52)  (74,52)  (56,72)  (42,92)  (71,92)

Forward M:
  [0.2815, -0.0165, 18.07]
  [0.0165,  0.2815, 33.26]

KPS mapping check:
  L.Eye: src=(819,576) → pred=(248.5,199.7)  target=(38.3,51.7) ❌
  ...
```

**問題**：KPS mapping 顯示所有點的預測值都與 ArcFace 模板差距巨大（248 vs 38）。這代表 Umeyama 計算的矩陣是錯的，或輸入的 KPS 根本不是正確的臉部關鍵點。

---

## 下一步建議

### A. 驗證 KPS 正確性（最優先）
1. 在原始照片上畫出偵測到的 `bbox` 和 `kps` 5個點
2. 確認這 5 個點確實是：左眼、右眼、鼻尖、左嘴角、右嘴角

```javascript
// 用 sharp composite 把 bbox 和 kps 畫在原圖上
const sharp = require('sharp');
// 生成帶標記的 preview 確認偵測位置是否正確
```

### B. 如果 KPS 正確，驗證 Umeyama 矩陣

`src/core/align.ts` 的 `umeyama2D()` 函式應該滿足：
```
M * kps[i] + t ≈ ARCFACE_DST_5PT[i]  for all i
```

即 `forward mapping` 把臉部 KPS 映射到 112×112 模板點。

目前測試發現 `pred=(248, 199)` 而 `target=(38, 52)`——差了一個數量級，說明 Umeyama 縮放因子計算可能有誤。

### C. 參考正確的 Umeyama/InsightFace 實作

- Python 版參考：[insightface/alignment](https://github.com/deepinsight/insightface/blob/master/python-package/insightface/utils/face_align.py)
- 標準做法是用 `skimage.transform.SimilarityTransform` 或手動 5-point Umeyama
- 確認 `src/core/align.ts` 的 `umeyama2D()` 公式與 Python 版一致

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `src/core/align.ts` | `alignFace()` 和 `umeyama2D()`，問題核心 |
| `src/core/scrfd.ts` | SCRFD 偵測，輸出 KPS 座標 |
| `src/core/detector.ts` | 串接 SCRFD + align + ArcFace 的主流程 |
| `test-diagnose.cjs` | SCRFD 模型原始輸出診斷腳本 |
| `test-e2e.cjs` | 端對端對齊測試（SCRFD→alignFace→存圖） |
| `test-verify-math.cjs` | Umeyama 矩陣數值驗證腳本 |
| `test-photos/refs/` | 測試用參考照 |
| `test-photos/aligned_*.png` | 目前輸出結果（不正確，為背景而非臉部） |

---

## 環境

- OS: Windows 11
- Node: v22.17.0
- Sharp: ^0.33.x
- onnxruntime-node: ^1.x
- SCRFD model: `models/insightface/det_500m.onnx`
- ArcFace model: `models/insightface/w600k_mbf.onnx`
