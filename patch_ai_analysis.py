import re

file_path = "/app/src/renderer/components/AIAnalysisPanel.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Main wrapper
content = re.sub(
    r"background:\s*'linear-gradient\(135deg, rgba\(15, 23, 42, 0\.95\) 0%, rgba\(30, 41, 59, 0\.95\) 100%\)',\s*borderRadius: '16px',\s*border: '1px solid rgba\(96, 165, 250, 0\.2\)',\s*padding: '20px',",
    "background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(24px)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.4)', padding: '24px', boxShadow: '0 12px 32px rgba(0,0,0,0.05)',",
    content
)

# 2. Animated background grid effect
content = re.sub(
    r"opacity: 0\.04,\s*backgroundImage: `\s*linear-gradient\(rgba\(96,165,250,0\.5\) 1px, transparent 1px\),\s*linear-gradient\(90deg, rgba\(96,165,250,0\.5\) 1px, transparent 1px\)\s*`,",
    "opacity: 0.1, backgroundImage: `linear-gradient(rgba(0,106,40,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,106,40,0.2) 1px, transparent 1px)`,",
    content
)

# 3. AI Icon Header
content = re.sub(
    r"background: 'linear-gradient\(135deg, #3b82f6 0%, #8b5cf6 100%\)',\s*display: 'flex',\s*alignItems: 'center',\s*justifyContent: 'center',\s*boxShadow: '0 0 20px rgba\(59, 130, 246, 0\.3\)',",
    "background: 'linear-gradient(135deg, #006a28 0%, #10b981 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0, 106, 40, 0.2)',",
    content
)

# 4. Text styles in Header
content = re.sub(
    r"color: 'rgba\(255,255,255,0\.95\)',",
    "color: '#006a28',",
    content
)
content = re.sub(
    r"color: 'rgba\(255,255,255,0\.4\)',",
    "color: '#595c5e',",
    content
)
content = re.sub(
    r"color: 'rgba\(96, 165, 250, 0\.9\)',",
    "color: '#006a28',",
    content
)

# 5. Progress bar track and fill
content = re.sub(
    r"background: 'rgba\(255,255,255,0\.06\)',",
    "background: 'rgba(0,0,0,0.06)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)', borderRadius: '99px', height: '6px',",
    content
)
content = re.sub(
    r"background: 'linear-gradient\(90deg, #3b82f6, #8b5cf6, #ec4899\)',\s*transition: 'width 0\.3s ease',\s*boxShadow: '0 0 8px rgba\(59, 130, 246, 0\.5\)',",
    "background: 'linear-gradient(90deg, #10b981, #006a28)', transition: 'width 0.3s ease', boxShadow: '0 0 12px rgba(16,185,129,0.4)', borderRadius: '99px',",
    content
)

# 6. Current photo thumbnail wrapper
content = re.sub(
    r"border: '1px solid rgba\(96, 165, 250, 0\.2\)',\s*background: 'rgba\(0,0,0,0\.3\)',",
    "border: '2px solid rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.05)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', borderRadius: '16px',",
    content
)
content = re.sub(
    r"color: 'rgba\(255,255,255,0\.2\)',",
    "color: 'rgba(0,0,0,0.3)', fontWeight: 600,",
    content
)

# 7. Scanning overlay
content = re.sub(
    r"background: 'linear-gradient\(180deg, transparent 0%, rgba\(59, 130, 246, 0\.15\) 100%\)',",
    "background: 'linear-gradient(180deg, transparent 0%, rgba(92, 253, 128, 0.2) 100%)',",
    content
)
content = re.sub(
    r"background: 'rgba\(96, 165, 250, 0\.6\)',\s*boxShadow: '0 0 8px rgba\(96, 165, 250, 0\.4\)',",
    "background: 'rgba(0, 106, 40, 0.6)', boxShadow: '0 0 12px rgba(0, 106, 40, 0.4)',",
    content
)

# 8. Analysis Details Text
content = re.sub(
    r"color: i === 0 \? '#60a5fa' : 'rgba\(255,255,255,0\.7\)',",
    "color: i === 0 ? '#006a28' : '#2c2f31', fontWeight: i===0?700:500,",
    content
)
content = re.sub(
    r"background: i === 0 \? '#60a5fa' : '#8b5cf6',",
    "background: i === 0 ? '#006a28' : '#10b981',",
    content
)
content = re.sub(
    r"color=\"linear-gradient\(90deg, #3b82f6, #8b5cf6\)\"",
    "color=\"linear-gradient(90deg, #10b981, #006a28)\"",
    content
)
content = re.sub(
    r"color: 'rgba\(255,255,255,0\.35\)',",
    "color: 'rgba(0,0,0,0.4)',",
    content
)

# 9. Stats row
content = re.sub(
    r"borderTop: '1px solid rgba\(255,255,255,0\.06\)',",
    "borderTop: '1px solid rgba(0,0,0,0.06)',",
    content
)

# 10. Speed and ETA text
content = re.sub(
    r"color: 'rgba\(255,255,255,0\.62\)',",
    "color: '#595c5e', fontWeight: 600,",
    content
)

# 11. CSS Keyframes
content = re.sub(
    r"box-shadow: 0 0 20px rgba\(59, 130, 246, 0\.3\)",
    "box-shadow: 0 0 20px rgba(0, 106, 40, 0.2)",
    content
)
content = re.sub(
    r"box-shadow: 0 0 30px rgba\(139, 92, 246, 0\.5\)",
    "box-shadow: 0 0 30px rgba(16, 185, 129, 0.4)",
    content
)

# 12. Fix the AnimatedCounter color which defaults to dark mode
# Wait, let's look at AnimatedCounter definition in the file

# Patch AnimatedCounter color and text
content = re.sub(
    r"background: 'linear-gradient\(135deg, #60a5fa, #a78bfa\)',",
    "background: 'linear-gradient(135deg, #006a28, #10b981)',",
    content
)
content = re.sub(
    r"color: 'rgba\(255,255,255,0\.5\)',",
    "color: '#595c5e', fontWeight: 600,",
    content
)

# Patch FeatureBar text colors
content = re.sub(
    r"color: 'rgba\(255,255,255,0\.7\)',",
    "color: '#595c5e', fontWeight: 600,",
    content
)
content = re.sub(
    r"background: 'rgba\(255,255,255,0\.08\)',",
    "background: 'rgba(0,0,0,0.06)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',",
    content
)

# Replace analysis lines dot coloring which we previously tried but might have failed due to syntax mismatch
# i === 0 ? '#60a5fa' : 'rgba(255,255,255,0.7)' -> i === 0 ? '#006a28' : '#2c2f31'
content = content.replace("i === 0 ? '#60a5fa' : 'rgba(255,255,255,0.7)'", "i === 0 ? '#006a28' : '#2c2f31'")
# i === 0 ? '#60a5fa' : '#8b5cf6' -> i === 0 ? '#006a28' : '#10b981'
content = content.replace("i === 0 ? '#60a5fa' : '#8b5cf6'", "i === 0 ? '#006a28' : '#10b981'")

# fileName color
content = content.replace("color: 'rgba(255,255,255,0.4)',", "color: '#595c5e',")


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("AIAnalysisPanel.tsx patched.")
