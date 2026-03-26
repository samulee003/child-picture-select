file_path = "/app/src/renderer/components/RefPhotoFeedback.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.4)', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden',\n      border: '1px solid rgba(0,0,0,0.06)',",
                          "borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.4)', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden',")

content = content.replace("borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.4)', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden',\n      background: 'rgba(255,255,255,0.6)',",
                          "borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.4)', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden',")


content = content.replace("border: '1px solid rgba(0, 106, 40, 0.2)', borderRadius: '999px', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',\n                  borderRadius: '4px',",
                          "border: '1px solid rgba(0, 106, 40, 0.2)', borderRadius: '999px', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',")


content = content.replace("background: 'rgba(251, 191, 36, 0.05)', fontSize: '12px', color: '#595c5e', padding: '12px',\n          fontSize: '10px',",
                          "background: 'rgba(251, 191, 36, 0.05)', fontSize: '12px', color: '#595c5e', padding: '12px',")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Duplicates fixed.")
