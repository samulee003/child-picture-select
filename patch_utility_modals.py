import re

modals = [
    "/app/src/renderer/components/HelpModal.tsx",
    "/app/src/renderer/components/ScanHistoryModal.tsx",
    "/app/src/renderer/components/PrivacySettingsPanel.tsx"
]

for file_path in modals:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Main Overlay background
    content = re.sub(
        r"background: 'rgba\(0,\s*0,\s*0,\s*0\.6\)',",
        "background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(8px)',",
        content
    )
    content = re.sub(
        r"backgroundColor: 'rgba\(0,\s*0,\s*0,\s*0\.5\)',",
        "backgroundColor: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(8px)',",
        content
    )

    # Modal Card background
    content = re.sub(
        r"background: theme\.colors\.neutral\[0\],",
        "background: 'rgba(255, 255, 255, 0.9)',",
        content
    )
    content = re.sub(
        r"backgroundColor: '#fff',",
        "backgroundColor: 'rgba(255, 255, 255, 0.9)',",
        content
    )

    # Border Radius
    content = re.sub(
        r"borderRadius: theme\.borderRadius\.lg,",
        "borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',",
        content
    )
    content = re.sub(
        r"borderRadius: '12px',",
        "borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',",
        content
    )

    # Title colors
    content = re.sub(
        r"color: theme\.colors\.neutral\[800\]",
        "color: '#006a28'",
        content
    )
    content = re.sub(
        r"color: '#333'",
        "color: '#006a28'",
        content
    )

    # Body text colors
    content = re.sub(
        r"color: theme\.colors\.neutral\[600\]",
        "color: '#595c5e'",
        content
    )
    content = re.sub(
        r"color: theme\.colors\.neutral\[500\]",
        "color: '#8d9296'",
        content
    )
    content = re.sub(
        r"color: '#666'",
        "color: '#595c5e'",
        content
    )

    # Separator line
    content = re.sub(
        r"borderBottom: `1px solid \$\{theme\.colors\.neutral\[200\]\}`",
        "borderBottom: '1px solid rgba(0, 0, 0, 0.06)'",
        content
    )
    content = re.sub(
        r"borderBottom: '1px solid #eee'",
        "borderBottom: '1px solid rgba(0, 0, 0, 0.06)'",
        content
    )
    content = re.sub(
        r"borderTop: `1px solid \$\{theme\.colors\.neutral\[200\]\}`",
        "borderTop: '1px solid rgba(0, 0, 0, 0.06)'",
        content
    )

    # Close/Action buttons
    content = re.sub(
        r"padding: `\$\{theme\.spacing\[2\]\} \$\{theme\.spacing\[4\]\}`,\s*background: theme\.colors\.primary\[500\],\s*color: theme\.colors\.neutral\[0\],\s*border: 'none',\s*borderRadius: theme\.borderRadius\.md,",
        "padding: '12px 24px', background: '#006a28', color: '#cfffce', border: 'none', borderRadius: '9999px', fontWeight: 600, boxShadow: '0 8px 16px rgba(0,106,40,0.2)', transition: 'all 0.2s',",
        content
    )
    content = re.sub(
        r"padding: '8px 16px',\s*backgroundColor: '#4CAF50',\s*color: 'white',\s*border: 'none',\s*borderRadius: '4px',",
        "padding: '12px 24px', backgroundColor: '#006a28', color: '#cfffce', border: 'none', borderRadius: '9999px', fontWeight: 600, boxShadow: '0 8px 16px rgba(0,106,40,0.2)', transition: 'all 0.2s',",
        content
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Utility Modals patched.")
