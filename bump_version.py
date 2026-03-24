import re
from datetime import date

# Bump package.json
with open('package.json', 'r', encoding='utf-8') as f:
    pkg = f.read()
pkg = re.sub(r'"version": "0\.2\.27"', r'"version": "0.3.0"', pkg)
with open('package.json', 'w', encoding='utf-8') as f:
    f.write(pkg)

# Bump README.md
with open('README.md', 'r', encoding='utf-8') as f:
    readme = f.read()
readme = re.sub(r'\*\*版本：0\.2\.9\*\*', r'**版本：0.3.0**', readme)
with open('README.md', 'w', encoding='utf-8') as f:
    f.write(readme)

# Update CHANGELOG.md
today = date.today().strftime('%Y-%m-%d')
changelog_entry = f"""
## [0.3.0] - {today}
### Changed
- **UI Redesign (Lumina Glass System)**: 全面升級使用者介面，導入溫暖、現代的毛玻璃 (Glassmorphism) 設計語言。
- **Swipe Review**: 全新設計的 Tinder 風格滑動審核介面，包含更直覺的滿版照片卡片與巨大按鍵。
- **Welcome & Onboarding**: 重新設計首頁與導覽流程，使用半透明對話框、大字體與柔和的漸層背景，降低非技術背景父母的使用門檻。
- **Typography**: 導入 `Plus Jakarta Sans` 與 `Inter` 字體，提升畫面高級感與易讀性。

"""

try:
    with open('CHANGELOG.md', 'r', encoding='utf-8') as f:
        changelog = f.read()

    # Insert after the first main heading
    idx = changelog.find('\n\n', changelog.find('# Changelog'))
    if idx != -1:
        new_changelog = changelog[:idx+2] + changelog_entry + changelog[idx+2:]
    else:
        new_changelog = changelog_entry + changelog

    with open('CHANGELOG.md', 'w', encoding='utf-8') as f:
        f.write(new_changelog)
except Exception as e:
    print("Could not update CHANGELOG.md:", e)
