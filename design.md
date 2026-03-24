# 大海撈B (Find My Kid) UI Redesign Guidelines

## 1. 核心設計理念 (Design Philosophy)
*   **目標受眾**: 非技術背景的亞洲父母 (Non-technical parents)。
*   **視覺風格**: 現代、乾淨、溫暖、有信任感的毛玻璃特效 (Modern, Clean, Warm, Glassmorphism)。
*   **操作核心**: 「極致傻瓜化」 (Foolproof). 讓篩選成千上萬張照片就像滑交友軟體一樣直覺且低負擔。

## 2. 色彩計畫 (Color Palette)
*   **背景 (Background)**: 柔和的漸層色調 (Soft, blurred gradient)，例如淡粉色、淺藍色或溫暖的米白色交織，不要純白或純黑，營造溫馨不冰冷的氛圍。
*   **主要行動 (Primary Action - Keep)**: 清新、有活力的綠色 (Vibrant Green)，例如 `#00C853`，代表「對，這是我小孩！」。
*   **次要行動 (Secondary Action - Discard)**: 柔和但不刺眼的紅色或橘紅色 (Soft Red/Coral)，例如 `#FF5252`，代表「這不是，丟掉」。
*   **文字 (Text)**: 深灰藍色 (Dark Grey/Blue) 取代純黑色，以保持整體的柔和感 (`#2C3E50` 或 `#34495E`)。

## 3. 介面結構 (Layout Structure)

這是一個桌面版應用程式的介面，主要分為兩個區塊：

### A. 左側邊欄 (Sidebar) - 簡潔的狀態指示
*   不需要複雜的選單，重點是讓家長知道「進度」。
*   使用半透明毛玻璃背景 (Glassmorphism card)。
*   顯示大字體的掃描進度：
    *   **已審核 (Reviewed)**: 大數字。
    *   **剩餘 (Remaining)**: 大數字。
*   可選：下方留有簡單的設定圖示或「退出」按鈕。

### B. 主視窗 (Main View) - Tinder-style 滑動審核卡片
*   **視覺中心**: 畫面正中央是一張極大的照片卡片 (Large central photo card)，四角圓滑。
*   **信心指數徽章 (Confidence Badge)**: 在照片卡片上方邊緣，有一個膠囊狀的徽章 (Pill-shaped badge)，寫著 AI 的判斷，例如「95% 相似 (95% Match)」。如果分數高，徽章可以是綠色；如果分數是邊緣值 (例如 60%)，可以是橘黃色。
*   **操作按鈕 (Action Buttons)**: 在照片卡片的正下方，並排兩個極大、顯眼的圓形按鈕：
    1.  **左邊 (Discard)**: 紅色圓形，裡面有一個大「X」圖示或向左的箭頭。
    2.  **右邊 (Keep)**: 綠色圓形，裡面有一個大「勾勾 (Checkmark)」圖示或向右的箭頭。
    *   按鈕應該要有立體感或浮起的效果 (Elevation/Shadow)。

## 4. 互動細節與限制 (Interactions & Constraints)
*   **無縫整合**: 此設計將套用於現有的 React/Electron 架構，重點在於 `src/renderer/components/SwipeReview.tsx` 的重新設計。
*   **維持既有邏輯**: 新的 UI 必須能夠接收原有的 props（如照片資料、保留/捨棄的 callback 函數）。設計的重點純粹是「美化外觀」，絕不能影響背後與 SQLite 或 AI 核心的資料傳遞。
*   **鍵盤支援暗示**: UI 上可以有極微小的暗示（例如在按鈕旁邊淡淡地寫上 `←` 和 `→`），告訴家長其實可以用鍵盤左右鍵來快速操作。
*   **動畫效果**: 點擊 Keep/Discard 時，卡片應該要有向右/向左飛出消失的過場動畫 (Swipe away animation)，讓操作有成就感。

## 5. Do's and Don'ts
*   **Do**: 把照片放得越大越好，家長主要是看照片。
*   **Do**: 使用大圓角 (border-radius) 讓所有元素看起來都很平易近人。
*   **Don't**: 不要使用生硬的 1px 實線邊框，全部用陰影 (box-shadow) 或背景色塊的差異來區隔版面。
*   **Don't**: 不要顯示過多複雜的技術資訊 (如特徵向量維度或處理時間)，家長只在乎「像不像」。
