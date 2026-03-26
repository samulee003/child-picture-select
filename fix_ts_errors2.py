with open("/app/src/renderer/components/AIAnalysisPanel.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix duplicates
content = content.replace("height: '3px',\n          borderRadius: '2px',\n          background: 'rgba(0,0,0,0.06)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)', borderRadius: '99px', height: '6px',",
                          "background: 'rgba(0,0,0,0.06)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)', borderRadius: '99px', height: '6px',")

content = content.replace("borderRadius: '2px',\n            width: `${percent}%`,\n            background: 'linear-gradient(90deg, #10b981, #006a28)', transition: 'width 0.3s ease', boxShadow: '0 0 12px rgba(16,185,129,0.4)', borderRadius: '99px',",
                          "width: `${percent}%`,\n            background: 'linear-gradient(90deg, #10b981, #006a28)', transition: 'width 0.3s ease', boxShadow: '0 0 12px rgba(16,185,129,0.4)', borderRadius: '99px',")

content = content.replace("borderRadius: '12px',\n            overflow: 'hidden',\n            border: '2px solid rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.05)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', borderRadius: '16px',",
                          "overflow: 'hidden',\n            border: '2px solid rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.05)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', borderRadius: '16px',")

with open("/app/src/renderer/components/AIAnalysisPanel.tsx", "w", encoding="utf-8") as f:
    f.write(content)


with open("/app/src/renderer/components/FaceAnalysisPreview.tsx", "r", encoding="utf-8") as f:
    content2 = f.read()

# FaceAnalysisPreview.tsx(161,42): error TS1117: An object literal cannot have multiple properties with the same name.
# src/renderer/components/FaceAnalysisPreview.tsx(424,117): error TS1117: An object literal cannot have multiple properties with the same name.
# Let's see them

# Fix FaceAnalysisPreview duplicates
content2 = content2.replace("borderRadius: '12px',\n        display: 'block',\n        width: '180px', height: '180px', borderRadius: '20px',",
                            "display: 'block',\n        width: '180px', height: '180px', borderRadius: '20px',")

content2 = content2.replace("padding: '12px 14px',\n            background: 'rgba(92, 253, 128, 0.1)', border: '1px solid rgba(0, 106, 40, 0.1)', borderRadius: '16px', padding: '16px',",
                            "background: 'rgba(92, 253, 128, 0.1)', border: '1px solid rgba(0, 106, 40, 0.1)', borderRadius: '16px', padding: '16px',")

with open("/app/src/renderer/components/FaceAnalysisPreview.tsx", "w", encoding="utf-8") as f:
    f.write(content2)

print("Duplicates fixed.")
