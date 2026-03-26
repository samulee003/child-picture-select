with open("/app/src/renderer/components/PrivacySettingsPanel.tsx", "r", encoding="utf-8") as f:
    content = f.read()
content = content.replace("border: 'none',\n        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',",
                          "borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',")
with open("/app/src/renderer/components/PrivacySettingsPanel.tsx", "w", encoding="utf-8") as f:
    f.write(content)


with open("/app/src/renderer/components/ScanHistoryModal.tsx", "r", encoding="utf-8") as f:
    content2 = f.read()
content2 = content2.replace("borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',\n        border: '1px solid rgba(0,0,0,0.07)',",
                            "borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',")
with open("/app/src/renderer/components/ScanHistoryModal.tsx", "w", encoding="utf-8") as f:
    f.write(content2)
