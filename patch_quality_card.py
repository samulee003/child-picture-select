import re

file_path = "/app/src/renderer/components/ReferencePhotoQualityCard.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace ImagePreview borderRadius
content = re.sub(
    r"borderRadius: theme\.borderRadius\.md",
    "borderRadius: '16px'",
    content
)

# Text colors
content = re.sub(
    r"color: theme\.colors\.neutral\[800\],",
    "color: '#2c2f31',",
    content
)
content = re.sub(
    r"color: theme\.colors\.neutral\[500\]",
    "color: '#595c5e'",
    content
)
content = re.sub(
    r"color: theme\.colors\.primary\[500\]",
    "color: '#006a28'",
    content
)
content = re.sub(
    r"color: theme\.colors\.neutral\[600\]",
    "color: '#595c5e'",
    content
)

# QualitySummary gradient
content = re.sub(
    r"background: theme\.gradients\.primary,",
    "background: 'linear-gradient(135deg, #006a28, #10b981)',",
    content
)

# Quality blocks
content = re.sub(
    r"background: 'rgba\(34, 197, 94, 0\.1\)',",
    "background: 'rgba(92, 253, 128, 0.1)',",
    content
)
content = re.sub(
    r"color: theme\.colors\.success\[600\]",
    "color: '#006a28'",
    content
)

content = re.sub(
    r"background: 'rgba\(245, 158, 11, 0\.1\)',",
    "background: 'rgba(251, 191, 36, 0.1)',",
    content
)
content = re.sub(
    r"color: theme\.colors\.warning\[600\]",
    "color: '#d97706'",
    content
)

content = re.sub(
    r"background: 'rgba\(239, 68, 68, 0\.1\)',",
    "background: 'rgba(180, 25, 36, 0.1)',",
    content
)
content = re.sub(
    r"color: theme\.colors\.error\[600\]",
    "color: '#b41924'",
    content
)

# Recommendations block
content = re.sub(
    r"background: 'rgba\(255, 255, 255, 0\.05\)',",
    "background: 'rgba(255, 255, 255, 0.4)',",
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
