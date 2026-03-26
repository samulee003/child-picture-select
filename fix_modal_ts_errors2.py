for file_path in ["/app/src/renderer/components/HelpModal.tsx", "/app/src/renderer/components/ScanHistoryModal.tsx", "/app/src/renderer/components/PrivacySettingsPanel.tsx"]:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Clean up duplicate box shadows
    content = content.replace("boxShadow: '0 8px 32px rgba(0,0,0,0.2)'", "")
    content = content.replace("boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'", "")
    content = content.replace("boxShadow: theme.shadows.xl", "")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
