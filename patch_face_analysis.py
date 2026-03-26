import re

file_path = "/app/src/renderer/components/FaceAnalysisPreview.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Refactor main wrapper box
content = re.sub(
    r"background: '#fff',\s*borderRadius: '16px',\s*border: '1px solid rgba\(0,0,0,0\.07\)',\s*padding: '24px',\s*boxShadow: '0 2px 16px rgba\(0,0,0,0\.07\)',",
    "background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(24px)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.4)', padding: '32px', boxShadow: '0 12px 32px rgba(0,0,0,0.05)',",
    content
)

# Refactor Header Icon
content = re.sub(
    r"width: '32px',\s*height: '32px',\s*borderRadius: '50%',\s*background: 'linear-gradient\(135deg, #0ea5e9, #06b6d4\)',",
    "width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #006a28, #10b981)', boxShadow: '0 8px 16px rgba(0, 106, 40, 0.2)',",
    content
)
content = re.sub(
    r"fontSize: '16px',\s*flexShrink: 0,",
    "fontSize: '24px', flexShrink: 0,",
    content
)

# Refactor Header Text
content = re.sub(
    r"fontWeight: 700, fontSize: '15px', color: theme\.colors\.neutral\[800\]",
    "fontFamily: \"'Plus Jakarta Sans', sans-serif\", fontWeight: 700, fontSize: '20px', color: '#006a28', letterSpacing: '-0.01em'",
    content
)
content = re.sub(
    r"fontSize: '12px', color: theme\.colors\.neutral\[400\], marginTop: '1px'",
    "fontSize: '14px', color: '#595c5e', marginTop: '4px'",
    content
)

# Refactor TypedText Status Box
content = re.sub(
    r"background: 'rgba\(14,165,233,0\.06\)',\s*border: '1px solid rgba\(14,165,233,0\.15\)',\s*borderRadius: '8px',\s*padding: '8px 12px',\s*fontSize: '12px',\s*color: '#0369a1',",
    "background: 'rgba(92, 253, 128, 0.1)', border: '1px solid rgba(0, 106, 40, 0.1)', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: '#006a28',",
    content
)

# Refactor Scanner Canvas Box
content = re.sub(
    r"width: '160px',\s*height: '160px',\s*border: isScanning \? '2px solid rgba\(0,220,200,0\.5\)' : '2px solid rgba\(0,0,0,0\.07\)',\s*boxShadow: isScanning \? '0 0 18px rgba\(0,220,200,0\.25\)' : 'none',",
    "width: '180px', height: '180px', borderRadius: '20px', border: isScanning ? '2px solid rgba(0, 106, 40, 0.5)' : '2px solid rgba(255,255,255,0.8)', boxShadow: isScanning ? '0 0 24px rgba(0, 106, 40, 0.3)' : '0 8px 24px rgba(0,0,0,0.08)',",
    content
)

# Refactor Scanner Line Color
content = re.sub(
    r"background: 'linear-gradient\(to bottom, transparent, rgba\(0,220,200,0\.8\) 90%, #0ff\)',",
    "background: 'linear-gradient(to bottom, transparent, rgba(92, 253, 128, 0.8) 90%, #006a28)',",
    content
)

# Refactor FeatureBar colors
content = re.sub(r'color="#0ea5e9"', 'color="#006a28"', content)
content = re.sub(r'color="#06b6d4"', 'color="#10b981"', content)
content = re.sub(r'color="#14b8a6"', 'color="#059669"', content)
content = re.sub(r'color="#6366f1"', 'color="#34d399"', content)

# Refactor FeatureBar style inside the component
content = re.sub(
    r"height: '6px',\s*borderRadius: '99px',\s*background: 'rgba\(0,0,0,0\.06\)',",
    "height: '8px', borderRadius: '99px', background: 'rgba(0,0,0,0.04)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',",
    content
)
content = re.sub(
    r"span style={{ fontSize: '11px', color: theme\.colors\.neutral\[500\] }}",
    "span style={{ fontSize: '12px', color: '#595c5e', fontWeight: 500 }}",
    content
)
content = re.sub(
    r"span style={{ fontSize: '11px', fontWeight: 600, color }}",
    "span style={{ fontSize: '12px', fontWeight: 700, color }}",
    content
)

# Refactor "AI 正在學習你的小孩" Header Container Flex
content = re.sub(
    r"display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'",
    "display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px'",
    content
)

# Refactor Progress dots
content = re.sub(
    r"background: i === currentIdx \? '#0ea5e9' : 'rgba\(0,0,0,0\.1\)',",
    "background: i === currentIdx ? '#006a28' : 'rgba(0,0,0,0.1)',",
    content
)

# Refactor Summary when done
content = re.sub(
    r"background: 'rgba\(16,185,129,0\.07\)',\s*border: '1px solid rgba\(16,185,129,0\.2\)',\s*borderRadius: '10px',\s*display: 'flex',\s*alignItems: 'center',\s*gap: '10px',",
    "background: 'rgba(92, 253, 128, 0.1)', border: '1px solid rgba(0, 106, 40, 0.1)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', backdropFilter: 'blur(8px)',",
    content
)
content = re.sub(
    r"fontWeight: 700, fontSize: '13px', color: '#065f46'",
    "fontWeight: 700, fontSize: '16px', color: '#006a28'",
    content
)
content = re.sub(
    r"fontSize: '11px', color: '#047857', marginTop: '2px'",
    "fontSize: '13px', color: '#2c2f31', marginTop: '4px'",
    content
)


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("FaceAnalysisPreview.tsx patched.")
