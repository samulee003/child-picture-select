file_path = "/app/src/renderer/components/RefPhotoFeedback.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("padding: `${theme.spacing[2]} ${theme.spacing[3]}`,\n        display: 'flex',\n        alignItems: 'center',\n        gap: theme.spacing[2],\n        background: faceCount === results.length ? 'rgba(92, 253, 128, 0.1)' : 'rgba(251, 191, 36, 0.1)', borderBottom: '1px solid rgba(0,0,0,0.04)', padding: '12px 16px',",
                          "display: 'flex',\n        alignItems: 'center',\n        gap: theme.spacing[2],\n        background: faceCount === results.length ? 'rgba(92, 253, 128, 0.1)' : 'rgba(251, 191, 36, 0.1)', borderBottom: '1px solid rgba(0,0,0,0.04)', padding: '12px 16px',")


content = content.replace("background: 'none',\n                  border: '1px solid rgba(0, 106, 40, 0.2)', borderRadius: '999px', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',",
                          "border: '1px solid rgba(0, 106, 40, 0.2)', borderRadius: '999px', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',")


content = content.replace("padding: `${theme.spacing[2]} ${theme.spacing[3]}`,\n          background: 'rgba(251, 191, 36, 0.05)', fontSize: '12px', color: '#595c5e', padding: '12px',",
                          "background: 'rgba(251, 191, 36, 0.05)', fontSize: '12px', color: '#595c5e', padding: '12px',")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Duplicates fixed.")
