import re

for file_path in ["/app/src/renderer/components/ExportPreviewModal.tsx", "/app/src/renderer/components/ExportSuccessModal.tsx"]:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Main Overlay background
    content = re.sub(
        r"background: 'rgba\(8, 12, 28, 0\.8\)',",
        "background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(8px)',",
        content
    )

    # Modal Card background
    content = re.sub(
        r"background: 'rgba\(14, 18, 40, 0\.9[78]\)',\s*borderRadius: theme\.borderRadius\.xl,\s*border: '1px solid rgba\(255, 255, 255, 0\.15\)',",
        "background: 'rgba(255, 255, 255, 0.9)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',",
        content
    )

    # Title text color
    content = re.sub(
        r"color: theme\.colors\.neutral\[100\]",
        "color: '#006a28'",
        content
    )

    # Body text color 1
    content = re.sub(
        r"color: theme\.colors\.neutral\[300\]",
        "color: '#595c5e'",
        content
    )

    # Body text color 2
    content = re.sub(
        r"color: theme\.colors\.neutral\[200\]",
        "color: '#2c2f31'",
        content
    )

    # Body text color 3
    content = re.sub(
        r"color: theme\.colors\.neutral\[400\]",
        "color: '#8d9296'",
        content
    )

    # Separator line
    content = re.sub(
        r"borderBottom: '1px solid rgba\(255, 255, 255, 0\.06\)',",
        "borderBottom: '1px solid rgba(0, 0, 0, 0.06)',",
        content
    )
    content = re.sub(
        r"borderTop: '1px solid rgba\(255, 255, 255, 0\.08\)',",
        "borderTop: '1px solid rgba(0, 0, 0, 0.08)',",
        content
    )

    # Button Base
    content = re.sub(
        r"borderRadius: theme\.borderRadius\.md,",
        "borderRadius: '9999px', fontWeight: 600, transition: 'all 0.2s',",
        content
    )

    # Button: Cancel
    content = re.sub(
        r"border: '1px solid rgba\(255, 255, 255, 0\.15\)',\s*color: theme\.colors\.neutral\[200\],\s*background: 'rgba\(255, 255, 255, 0\.04\)',",
        "border: '1px solid rgba(0, 0, 0, 0.1)', color: '#595c5e', background: 'rgba(0, 0, 0, 0.04)',",
        content
    )

    # Button: Primary Green
    content = re.sub(
        r"border: '1px solid rgba\(16, 185, 129, 0\.4\)',\s*color: '#10b981',\s*background: (.*) \? 'rgba\(16, 185, 129, 0\.06\)' : 'rgba\(16, 185, 129, 0\.12\)',",
        r"border: 'none', color: '#cfffce', background: \1 ? '#9a9d9f' : '#006a28', boxShadow: \1 ? 'none' : '0 8px 16px rgba(0, 106, 40, 0.2)',",
        content
    )
    content = re.sub(
        r"border: '1px solid rgba\(16, 185, 129, 0\.4\)',\s*color: '#10b981',\s*background: 'rgba\(16, 185, 129, 0\.12\)',",
        "border: 'none', color: '#cfffce', background: '#006a28', boxShadow: '0 8px 16px rgba(0, 106, 40, 0.2)',",
        content
    )

    # Button: Secondary Blue
    content = re.sub(
        r"border: '1px solid rgba\(56, 189, 248, 0\.4\)',\s*color: '#38bdf8',\s*background: 'rgba\(56, 189, 248, 0\.12\)',",
        "border: '1px solid rgba(0, 106, 40, 0.2)', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',",
        content
    )
    content = re.sub(
        r"border: '1px solid rgba\(96, 165, 250, 0\.4\)',\s*color: '#60a5fa',\s*background: 'rgba\(96, 165, 250, 0\.12\)',",
        "border: '1px solid rgba(0, 106, 40, 0.2)', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',",
        content
    )

    # Button: Retry Yellow
    content = re.sub(
        r"border: '1px solid rgba\(245, 158, 11, 0\.4\)',\s*color: '#f59e0b',\s*background: 'rgba\(245, 158, 11, 0\.12\)',",
        "border: '1px solid rgba(245, 158, 11, 0.3)', color: '#d97706', background: 'rgba(251, 191, 36, 0.1)',",
        content
    )

    # Success modal specific colors
    content = re.sub(
        r"color: '#ef4444'",
        "color: '#b41924'",
        content
    )
    content = re.sub(
        r"color: '#f59e0b'",
        "color: '#d97706'",
        content
    )
    content = re.sub(
        r"color: '#10b981'",
        "color: '#006a28'",
        content
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Export Modals patched.")
