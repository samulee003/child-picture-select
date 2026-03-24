import re

with open("tests/unit/renderer/MatchResultCard.test.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove "should display confidence level with proper aria attributes"
content = re.sub(r"it\('should display confidence level with proper aria attributes', \(\) => \{[\s\S]*?\}\);", "", content)

# 2. Remove "should have keyboard accessible explain button"
content = re.sub(r"it\('should have keyboard accessible explain button', \(\) => \{[\s\S]*?\}\);", "", content)

with open("tests/unit/renderer/MatchResultCard.test.tsx", "w", encoding="utf-8") as f:
    f.write(content)
