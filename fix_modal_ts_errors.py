for file_path in ["/app/src/renderer/components/HelpModal.tsx", "/app/src/renderer/components/ScanHistoryModal.tsx", "/app/src/renderer/components/PrivacySettingsPanel.tsx"]:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Fix HelpModal border-radius duplicate
    content = content.replace(
        "background: 'rgba(255, 255, 255, 0.9)',\n        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',\n        width: '100%',\n        maxWidth: '600px',\n        maxHeight: '85vh',\n        display: 'flex',\n        flexDirection: 'column',\n        overflow: 'hidden',\n        boxShadow: theme.shadows.xl,",
        "background: 'rgba(255, 255, 255, 0.9)',\n        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',\n        width: '100%',\n        maxWidth: '600px',\n        maxHeight: '85vh',\n        display: 'flex',\n        flexDirection: 'column',\n        overflow: 'hidden',"
    )

    # Fix ScanHistoryModal border-radius duplicate
    content = content.replace(
        "background: 'rgba(255, 255, 255, 0.9)',\n        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',\n        width: '100%',\n        maxWidth: '800px',\n        maxHeight: '85vh',\n        display: 'flex',\n        flexDirection: 'column',\n        overflow: 'hidden',\n        boxShadow: theme.shadows.xl,",
        "background: 'rgba(255, 255, 255, 0.9)',\n        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',\n        width: '100%',\n        maxWidth: '800px',\n        maxHeight: '85vh',\n        display: 'flex',\n        flexDirection: 'column',\n        overflow: 'hidden',"
    )

    # Fix PrivacySettingsPanel duplicate
    content = content.replace(
        "backgroundColor: 'rgba(255, 255, 255, 0.9)',\n          padding: '24px',\n          borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',\n          width: '500px',\n          maxWidth: '90%',\n          maxHeight: '90vh',\n          overflowY: 'auto',\n          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'",
        "backgroundColor: 'rgba(255, 255, 255, 0.9)',\n          padding: '24px',\n          borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',\n          width: '500px',\n          maxWidth: '90%',\n          maxHeight: '90vh',\n          overflowY: 'auto',"
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Duplicates fixed in modals.")
