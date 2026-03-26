import re
file_path = "/app/src/renderer/App.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Let's count { and } around the start_scan_btn block we just injected
# Ah! I see what happened. In the `start_scan_btn` string, I didn't replace the tag but rather the text, but the `start_scan_btn` already contains `<button>...</button>`.
# Wait, let's look at the button regex replacement:
# r"<ModernButton\s*variant=\"success\"\s*size=\"lg\"\s*fullWidth\s*loading=\{scan\.isProcessing\}\s*disabled=\{\s*scan\.isProcessing \|\|\s*!scan\.folder\.trim\(\) \|\|\s*\(scan\.refsLoaded === 0 && scan\.refPaths\.trim\(\) === ''\) \|\|\s*scan\.modelStatus\?\.loaded === false\s*\}\s*onClick=\{scan\.handleRunScan\}\s*>\s*\{scan\.isProcessing\s*\?\s*'處理中\.\.\.'\s*:\s*scan\.refsLoaded === 0 && scan\.refPaths\.trim\(\)\s*\?\s*'載入照片並搜尋'\s*:\s*'開始搜尋'\}\s*</ModernButton>"

print("Finding ModernButton...")
import re
# check how many ModernButton tags are in the file still
count = len(re.findall(r"<ModernButton", content))
print("ModernButton count:", count)
