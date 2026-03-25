import re

file_path = "/app/src/renderer/App.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix logo image import for App.tsx as well
if "import logoImg from" not in content:
    content = content.replace("import React, { useState, useEffect, useCallback } from 'react';", "import React, { useState, useEffect, useCallback } from 'react';\nimport logoImg from '../public/logo.png';")
    content = content.replace('src="logo.png"', 'src={logoImg}')


# 1. Update the overall wrapper to use the new background gradient
content = re.sub(
    r"background: 'linear-gradient\(135deg, #f8fafc 0%, #f1f5f9 100%\)',",
    "background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',",
    content
)

# 2. Redesign the Left Sidebar shell (lines ~215)
content = re.sub(
    r"width: '380px',\s*flexShrink: 0,\s*display: 'flex',\s*flexDirection: 'column',\s*borderRight: `1px solid rgba\(0,0,0,0\.06\)`,\s*background:\s*'linear-gradient\(180deg, rgba\(255,255,255,0\.9\) 0%, rgba\(248,250,252,0\.95\) 100%\)',\s*backdropFilter: 'blur\(20px\)',",
    "width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(32px)', zIndex: 10, boxShadow: '4px 0 24px rgba(0,0,0,0.02)', margin: '12px', borderRadius: '24px', height: 'calc(100vh - 24px)', overflow: 'hidden',",
    content
)

# Fix right main content flex and padding to align with margin of the sidebar
content = re.sub(
    r"flex: 1,\s*overflowY: 'auto',\s*position: 'relative',\s*display: 'flex',\s*flexDirection: 'column',\s*background: 'transparent',\s*}\}",
    "flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', background: 'transparent', borderRadius: '24px', margin: '12px 12px 12px 0', }",
    content
)

# 3. Compact Header
content = re.sub(
    r"padding: `\$\{theme\.spacing\[3\]\} \$\{theme\.spacing\[4\]\}`,\s*borderBottom: '1px solid rgba\(0,0,0,0\.06\)',",
    "padding: `24px 20px 16px`, borderBottom: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.3)',",
    content
)


# 4. Reference Photos DragDropZone background
content = re.sub(
    r"border: `2px dashed \$\{scan\.refPaths\.trim\(\) \? theme\.colors\.primary\[300\] : theme\.colors\.neutral\[300\]\}`,\s*borderRadius: theme\.borderRadius\.md,\s*padding: scan\.refPaths\.trim\(\) \? theme\.spacing\[3\] : theme\.spacing\[4\],\s*textAlign: 'center',\s*background: scan\.refPaths\.trim\(\)\s*\?\s*'rgba\(58,123,170,0\.04\)'\s*:\s*'rgba\(255,255,255,0\.5\)',",
    "border: `2px dashed ${scan.refPaths.trim() ? 'rgba(0,106,40,0.3)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '16px', padding: scan.refPaths.trim() ? theme.spacing[3] : theme.spacing[4], textAlign: 'center', background: scan.refPaths.trim() ? 'rgba(92,253,128,0.1)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)',",
    content
)

# 5. Folder DragDropZone background
content = re.sub(
    r"border: `2px dashed \$\{scan\.folder\.trim\(\) \? theme\.colors\.primary\[300\] : theme\.colors\.neutral\[300\]\}`,\s*borderRadius: theme\.borderRadius\.md,\s*padding: scan\.folder\.trim\(\) \? theme\.spacing\[3\] : theme\.spacing\[4\],\s*textAlign: 'center',\s*background: scan\.folder\.trim\(\)\s*\?\s*'rgba\(58,123,170,0\.04\)'\s*:\s*'rgba\(255,255,255,0\.5\)',",
    "border: `2px dashed ${scan.folder.trim() ? 'rgba(0,106,40,0.3)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '16px', padding: scan.folder.trim() ? theme.spacing[3] : theme.spacing[4], textAlign: 'center', background: scan.folder.trim() ? 'rgba(92,253,128,0.1)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)',",
    content
)

# 6. Numbers background (1, 2, 3)
content = re.sub(
    r"background: scan\.refPaths\.trim\(\) \? '#10b981' : theme\.colors\.primary\[500\]",
    "background: scan.refPaths.trim() ? '#006a28' : '#006a28'",
    content
)
content = re.sub(
    r"background: scan\.folder\.trim\(\) \? '#10b981' : theme\.colors\.primary\[500\]",
    "background: scan.folder.trim() ? '#006a28' : '#b41924'",
    content
)
content = re.sub(
    r"background: theme\.colors\.neutral\[400\],\s*color: '#fff',",
    "background: '#595c5e', color: '#fff',",
    content
)


# 7. Search mode buttons
content = re.sub(
    r"borderRadius: theme\.borderRadius\.md,\s*border: `2px solid \$\{Math\.abs\(scan\.threshold - preset\.value\) < 0\.08 \? preset\.color : 'rgba\(0,0,0,0\.08\)'\}`,\s*background:\s*Math\.abs\(scan\.threshold - preset\.value\) < 0\.08\s*\?\s*`\$\{preset\.color\}12`\s*:\s*'transparent',",
    "borderRadius: '12px', border: `2px solid ${Math.abs(scan.threshold - preset.value) < 0.08 ? preset.color : 'rgba(255,255,255,0.5)'}`, background: Math.abs(scan.threshold - preset.value) < 0.08 ? `${preset.color}12` : 'rgba(255,255,255,0.5)', backdropFilter: 'blur(4px)',",
    content
)

# 8. Sticky CTA section at the bottom
content = re.sub(
    r"padding: `\$\{theme\.spacing\[3\]\} \$\{theme\.spacing\[4\]\}`,\s*borderTop: '1px solid rgba\(0,0,0,0\.06\)',\s*background: 'rgba\(255,255,255,0\.95\)',",
    "padding: `20px`, borderTop: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(12px)',",
    content
)

# 9. ModernButton "start scan" - make it pill shape matching welcome state
# Actually, ModernButton already handles its own styling, but we can override it if we need.
# Let's replace the ModernButton for the Start Scan with a native button to match WelcomeState pill exactly
start_scan_btn = """
          <button
            disabled={
              scan.isProcessing ||
              !scan.folder.trim() ||
              (scan.refsLoaded === 0 && scan.refPaths.trim() === '') ||
              scan.modelStatus?.loaded === false
            }
            onClick={scan.handleRunScan}
            style={{
                width: '100%',
                padding: '16px',
                borderRadius: '9999px',
                border: 'none',
                background: scan.isProcessing ? '#9a9d9f' :
                            (!scan.folder.trim() || (scan.refsLoaded === 0 && scan.refPaths.trim() === '')) ? 'rgba(0,0,0,0.1)' : '#006a28',
                color: scan.isProcessing ? '#ffffff' :
                       (!scan.folder.trim() || (scan.refsLoaded === 0 && scan.refPaths.trim() === '')) ? 'rgba(0,0,0,0.3)' : '#cfffce',
                fontSize: '16px',
                fontWeight: 700,
                cursor: (scan.isProcessing || !scan.folder.trim() || (scan.refsLoaded === 0 && scan.refPaths.trim() === '')) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: (!scan.folder.trim() || (scan.refsLoaded === 0 && scan.refPaths.trim() === '')) ? 'none' : '0 8px 16px rgba(0, 106, 40, 0.2)',
                transition: 'all 0.2s'
            }}
          >
            {scan.isProcessing
              ? '處理中...'
              : scan.refsLoaded === 0 && scan.refPaths.trim()
                ? '載入照片並搜尋'
                : '開始搜尋'}
          </button>
"""
# Find the exact ModernButton tag and replace
content = re.sub(
    r"<ModernButton\s*variant=\"success\"\s*size=\"lg\"\s*fullWidth\s*loading=\{scan\.isProcessing\}\s*disabled=\{\s*scan\.isProcessing \|\|\s*!scan\.folder\.trim\(\) \|\|\s*\(scan\.refsLoaded === 0 && scan\.refPaths\.trim\(\) === ''\) \|\|\s*scan\.modelStatus\?\.loaded === false\s*\}\s*onClick=\{scan\.handleRunScan\}\s*>\s*\{scan\.isProcessing\s*\?\s*'處理中\.\.\.'\s*:\s*scan\.refsLoaded === 0 && scan\.refPaths\.trim\(\)\s*\?\s*'載入照片並搜尋'\s*:\s*'開始搜尋'\}\s*</ModernButton>",
    start_scan_btn,
    content
)

# 10. Update Model Warning/Error boxes
content = re.sub(
    r"padding: theme\.spacing\[3\],\s*borderRadius: theme\.borderRadius\.md,\s*background: scan\.modelStatus\.error\s*\?\s*'rgba\(239, 68, 68, 0\.1\)'\s*:\s*'rgba\(245, 158, 11, 0\.1\)',\s*border: `1px solid \$\{scan\.modelStatus\.error \? 'rgba\(239,68,68,0\.25\)' : 'rgba\(245,158,11,0\.25\)'\}`,",
    "padding: theme.spacing[3], borderRadius: '12px', background: scan.modelStatus.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: `1px solid ${scan.modelStatus.error ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`, backdropFilter: 'blur(4px)',",
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("App.tsx Sidebar layout patched.")
