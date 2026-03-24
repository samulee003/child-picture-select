import re

with open("tests/unit/renderer/OnboardingWizard.test.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# The test fails because I changed "跳過，先直接使用" to "跳過，直接使用"
content = content.replace("跳過，先直接使用", "跳過，直接使用")

with open("tests/unit/renderer/OnboardingWizard.test.tsx", "w", encoding="utf-8") as f:
    f.write(content)
