import re

with open("src/renderer/components/ModernLayout.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Make the app background the soft gradient so the white glass cards pop
# Current: background: '#f5f7fa',
content = re.sub(
    r"background: '#f5f7fa',",
    r"background: 'linear-gradient(135deg, #f5f7f9 0%, #eef1f3 100%)',",
    content
)

# ModernSection currently has a border and background. Let's make it glassmorphism.
# Current section:
#     <section style={{
#       background: theme.colors.neutral[0],
#       borderRadius: theme.borderRadius.xl,
#       boxShadow: theme.shadows.sm,
#       border: `1px solid ${theme.colors.neutral[200]}`,
#       overflow: 'hidden',

pattern = r"background: theme\.colors\.neutral\[0\],\s*borderRadius: theme\.borderRadius\.xl,\s*boxShadow: theme\.shadows\.sm,\s*border: `1px solid \$\{theme\.colors\.neutral\[200\]\}`,"

new_section = r"""background: 'rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(24px)',
      borderRadius: '24px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.03)',
      border: '1px solid rgba(255,255,255,0.5)',"""

content = re.sub(pattern, new_section, content)

with open("src/renderer/components/ModernLayout.tsx", "w", encoding="utf-8") as f:
    f.write(content)
