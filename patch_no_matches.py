import re

file_path = "/app/src/renderer/components/NoMatchesSection.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace btnBase to be pill shaped and more modern
content = re.sub(
    r"const btnBase = \{\s*borderRadius: theme\.borderRadius\.md,\s*padding: `\$\{theme\.spacing\[2\]\} \$\{theme\.spacing\[3\]\}`,\s*cursor: isProcessing \? 'not-allowed' as const : 'pointer' as const,\s*\};",
    "const btnBase = {\n    borderRadius: '9999px',\n    padding: '12px 24px',\n    fontWeight: 600,\n    fontSize: '15px',\n    cursor: isProcessing ? 'not-allowed' as const : 'pointer' as const,\n    transition: 'all 0.2s',\n    backdropFilter: 'blur(8px)',\n  };",
    content
)

# Replace the inner padding/text styling to be softer glass
content = re.sub(
    r"textAlign: 'center',\s*padding: theme\.spacing\[16\],\s*color: theme\.colors\.neutral\[600\],",
    "textAlign: 'center', padding: '64px', color: '#595c5e', background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(24px)', borderRadius: '32px', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 12px 32px rgba(0,0,0,0.05)',",
    content
)

# Text colors
content = re.sub(
    r"color: theme\.colors\.neutral\[700\],",
    "color: '#2c2f31',",
    content
)
content = re.sub(
    r"color: theme\.colors\.neutral\[600\],",
    "color: '#595c5e',",
    content
)

# Refactor the buttons colors from dark mode glow to light mode soft glass
# 1. Lower Threshold (Blue -> Greenish)
content = re.sub(
    r"border: '1px solid rgba\(59, 130, 246, 0\.4\)',\s*color: '#60a5fa',\s*background: 'rgba\(96, 165, 250, 0\.12\)',",
    "border: '1px solid rgba(0, 106, 40, 0.2)', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)', boxShadow: '0 4px 12px rgba(0, 106, 40, 0.1)',",
    content
)

# 2. Clear Cache (Red)
content = re.sub(
    r"border: '1px solid rgba\(239, 68, 68, 0\.4\)',\s*color: '#ef4444',\s*background: 'rgba\(239, 68, 68, 0\.12\)',",
    "border: '1px solid rgba(180, 25, 36, 0.2)', color: '#b41924', background: 'rgba(180, 25, 36, 0.05)', boxShadow: '0 4px 12px rgba(180, 25, 36, 0.1)',",
    content
)

# 3. Add Ref (Yellow/Amber -> Soft Yellow)
content = re.sub(
    r"border: '1px solid rgba\(251, 191, 36, 0\.4\)',\s*color: '#fbbf24',\s*background: 'rgba\(251, 191, 36, 0\.12\)',",
    "border: '1px solid rgba(245, 158, 11, 0.3)', color: '#d97706', background: 'rgba(251, 191, 36, 0.1)', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)',",
    content
)

# 4. Switch Pending (Green -> Solid Green)
content = re.sub(
    r"border: '1px solid rgba\(16, 185, 129, 0\.4\)',\s*color: '#10b981',\s*background: 'rgba\(16, 185, 129, 0\.12\)',",
    "border: 'none', color: '#cfffce', background: '#006a28', boxShadow: '0 8px 16px rgba(0, 106, 40, 0.2)',",
    content
)


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
