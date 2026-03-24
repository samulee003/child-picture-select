import re

with open("src/renderer/components/SwipeReview.tsx", "r", encoding="utf-8") as f:
    content = f.read()

pattern = r'if \(!current \|\| remaining === 0\) \{\s*return \(\s*<div style=\{\{\s*position: \'fixed\', inset: 0, zIndex: 9999,\s*background: \'rgba\(0,0,0,0\.85\)\',\s*display: \'flex\', flexDirection: \'column\', alignItems: \'center\', justifyContent: \'center\',\s*color: \'#fff\',\s*\}\}>\s*<div style=\{\{ fontSize: \'48px\', marginBottom: \'16px\' \}\}>🎉</div>\s*<h2 style=\{\{ margin: 0, fontSize: \'24px\', fontWeight: 700 \}\}>全部審核完畢！</h2>\s*<p style=\{\{ color: \'rgba\(255,255,255,0\.6\)\', marginTop: \'8px\' \}\}>\s*已審核 \{Object\.keys\(reviewDecisions\)\.length\} 張照片\s*</p>\s*<button\s*onClick=\{onClose\}\s*style=\{\{\s*marginTop: \'24px\',\s*padding: \'12px 32px\',\s*borderRadius: \'12px\',\s*border: \'none\',\s*background: theme\.colors\.primary\[500\],\s*color: \'#fff\',\s*fontSize: \'16px\',\s*fontWeight: 600,\s*cursor: \'pointer\',\s*\}\}\s*>\s*返回結果\s*</button>\s*</div>\s*\);\s*\}'

replacement = """if (!current || remaining === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#2c2f31',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          padding: '40px',
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>✨</div>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 700, color: '#006a28' }}>全部審核完畢！</h2>
          <p style={{ color: '#595c5e', marginTop: '12px', fontSize: '18px' }}>
            已審核 {Object.keys(reviewDecisions).length} 張照片
          </p>
          <button
            onClick={onClose}
            style={{
              marginTop: '32px',
              padding: '16px 48px',
              borderRadius: '9999px',
              border: 'none',
              background: '#006a28',
              color: '#cfffce',
              fontSize: '18px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 106, 40, 0.3)',
              transition: 'transform 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            返回結果
          </button>
        </div>
      </div>
    );
  }"""

new_content = re.sub(pattern, replacement, content)

if content == new_content:
    print("Warning: Pattern not found for 'All Done'")
else:
    print("Successfully replaced 'All Done'")

with open("src/renderer/components/SwipeReview.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)
