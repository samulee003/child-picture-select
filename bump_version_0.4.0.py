import re
from datetime import date

# Bump package.json
with open('/app/package.json', 'r', encoding='utf-8') as f:
    pkg = f.read()
pkg = re.sub(r'"version": "0\.3\.0"', r'"version": "0.4.0"', pkg)
with open('/app/package.json', 'w', encoding='utf-8') as f:
    f.write(pkg)

# Update CHANGELOG.md
today = date.today().strftime('%Y-%m-%d')
changelog_entry = f"""
## [0.4.0] - {today}
### Changed
- **UI Redesign Phase 2 (Lumina Glass System)**: 全面升級剩下的所有介面，包括：
  - 左側控制列 (Sidebar) 更新為半透明毛玻璃質感。
  - AI 掃描進度畫面 (`AIAnalysisPanel`) 由深色改為明亮、溫和的漸層。
  - 任務前置檢查 (`TaskReadinessCard`)、參考照片品質 (`RefPhotoFeedback`)、查無結果 (`NoMatchesSection`) 等回饋卡片使用新版圓角與膠囊按鈕。
  - 匯出視窗 (`ExportPreviewModal` 等)、隱私與歷史紀錄設定面板 (`PrivacySettingsPanel`) 全面套用明亮版毛玻璃特效，移除過去的深色遮罩，讓整體軟體調性一致且溫馨。
"""

try:
    with open('/app/CHANGELOG.md', 'r', encoding='utf-8') as f:
        changelog = f.read()

    # Insert before the 0.3.0 heading
    idx = changelog.find('## [0.3.0]')
    if idx != -1:
        new_changelog = changelog[:idx] + changelog_entry + changelog[idx:]
    else:
        new_changelog = changelog_entry + changelog

    with open('/app/CHANGELOG.md', 'w', encoding='utf-8') as f:
        f.write(new_changelog)
except Exception as e:
    print("Could not update CHANGELOG.md:", e)
