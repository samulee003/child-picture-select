import re

file_path = "/app/src/renderer/components/RefPhotoFeedback.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Update the main wrapper
content = re.sub(
    r"borderRadius: theme\.borderRadius\.md,\s*border: '1px solid rgba\(0,0,0,0\.06\)',\s*background: 'rgba\(255,255,255,0\.6\)',\s*overflow: 'hidden',",
    "borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.4)', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden',",
    content
)

# Summary bar
content = re.sub(
    r"background: faceCount === results\.length \? 'rgba\(16,185,129,0\.06\)' : 'rgba\(245,158,11,0\.06\)',\s*borderBottom: '1px solid rgba\(0,0,0,0\.04\)',",
    "background: faceCount === results.length ? 'rgba(92, 253, 128, 0.1)' : 'rgba(251, 191, 36, 0.1)', borderBottom: '1px solid rgba(0,0,0,0.04)', padding: '12px 16px',",
    content
)

content = re.sub(
    r"color: theme\.colors\.neutral\[700\],\s*fontWeight: 600,",
    "color: '#2c2f31', fontWeight: 600,",
    content
)

content = re.sub(
    r"color: '#f59e0b',",
    "color: '#d97706', fontWeight: 600,",
    content
)

# Enhance button
content = re.sub(
    r"border: '1px solid rgba\(59,130,246,0\.3\)',\s*borderRadius: '4px',\s*color: '#3b82f6',",
    "border: '1px solid rgba(0, 106, 40, 0.2)', borderRadius: '999px', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',",
    content
)

# Tip section
content = re.sub(
    r"background: 'rgba\(245,158,11,0\.04\)',\s*fontSize: '10px',\s*color: theme\.colors\.neutral\[500\],",
    "background: 'rgba(251, 191, 36, 0.05)', fontSize: '12px', color: '#595c5e', padding: '12px',",
    content
)

# Per-file list items spacing
content = re.sub(
    r"padding: `\$\{theme\.spacing\[1\]\} \$\{theme\.spacing\[3\]\}`,",
    "padding: '8px 16px',",
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
