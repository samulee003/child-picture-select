import re

file_path = "/app/src/renderer/components/TaskReadinessCard.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(
    r"background: 'rgba\(14, 116, 144, 0\.08\)',\s*border: '1px solid rgba\(14, 116, 144, 0\.25\)',",
    "background: 'rgba(92, 253, 128, 0.1)', border: '1px solid rgba(0, 106, 40, 0.1)', borderRadius: '16px', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', padding: '16px',",
    content
)

content = re.sub(
    r"color: theme\.colors\.neutral\[800\],",
    "color: '#006a28',",
    content
)

content = re.sub(
    r"color: theme\.colors\.neutral\[700\]",
    "color: '#595c5e'",
    content
)

content = re.sub(
    r"color: item\.ok \? '#16a34a' : '#b45309'",
    "color: item.ok ? '#006a28' : '#b41924', fontWeight: 600",
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
