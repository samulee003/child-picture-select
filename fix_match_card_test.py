with open("tests/unit/renderer/MatchResultCard.test.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# The UI design changed the text from "85.0%" to "85% 相似" and removed the "為何匹配？" (Explain) button.
# Let's see the failures:
# 1. '85.0%' -> '85% 相似'
content = content.replace("getByText('85.0%')", "getByText('85% 相似')")
content = content.replace("getByText('95.0%')", "getByText('95% 相似')")
content = content.replace("getByText('65.0%')", "getByText('65% 相似')")
content = content.replace("getByText('40.0%')", "getByText('40% 相似')")

# 2. '為何匹配？' was removed in the compact/detailed view update. The new card just shows reasons if not compact.
import re
# Remove the test blocks testing "為何匹配？" toggle entirely
content = re.sub(r"it\('should toggle explanation panel', \(\) => \{[\s\S]*?\}\);", "", content)
content = re.sub(r"it\('should show explanation panel when expanded', \(\) => \{[\s\S]*?\}\);", "", content)

# 3. Accessibility test "has accessible explanation toggle"
content = re.sub(r"it\('has accessible explanation toggle', \(\) => \{[\s\S]*?\}\);", "", content)


with open("tests/unit/renderer/MatchResultCard.test.tsx", "w", encoding="utf-8") as f:
    f.write(content)
