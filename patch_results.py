import re

with open("src/renderer/components/ResultsSection.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the filterBtnStyle logic to match new style
filter_btn_pattern = r'const filterBtnStyle = \(active: boolean\) => \(\{[\s\S]*?\}\);'
new_filter_btn_style = """const filterBtnStyle = (active: boolean) => ({
    borderRadius: '999px',
    border: 'none',
    color: active ? '#ffffff' : '#595c5e',
    background: active ? '#006a28' : 'rgba(255, 255, 255, 0.5)',
    padding: '8px 16px',
    cursor: 'pointer' as const,
    fontWeight: 600,
    fontSize: '14px',
    boxShadow: active ? '0 4px 12px rgba(0, 106, 40, 0.2)' : '0 2px 8px rgba(0,0,0,0.02)',
    transition: 'all 0.2s ease',
  });"""
content = re.sub(filter_btn_pattern, new_filter_btn_style, content)

# Replace the layout above the Grid
# The header section starts after `return (` and ends before `<div ref={containerRef}`
header_pattern = r'return \(\s*<div style=\{\{\s*display: \'flex\', flexDirection: \'column\', height: \'100%\', gap: theme\.spacing\[4\]\s*\}\}>\s*\{/\* Top controls \*/\}[\s\S]*?\{/\* Virtualized Grid \*/\}'

new_header = """return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', gap: '24px',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Top controls - Lumina Glass Style */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(24px)',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid rgba(255,255,255,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{
              margin: 0,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '28px',
              fontWeight: 700,
              color: '#006a28',
              letterSpacing: '-0.02em',
              marginBottom: '4px'
            }}>掃描結果</h2>
            <div style={{ fontSize: '14px', color: '#595c5e' }}>
               找到 {props.results.length} 張相符照片
            </div>
          </div>

          {/* Stats Badges */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.6)', padding: '12px 20px', borderRadius: '16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px'
            }}>
               <span style={{ fontSize: '12px', color: '#595c5e', fontWeight: 600 }}>待複核</span>
               <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 700, color: '#b41924' }}>
                 {pendingCount}
               </span>
            </div>
             <div style={{
              background: 'rgba(255,255,255,0.6)', padding: '12px 20px', borderRadius: '16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px'
            }}>
               <span style={{ fontSize: '12px', color: '#595c5e', fontWeight: 600 }}>已確認</span>
               <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 700, color: '#006a28' }}>
                 {acceptedCount}
               </span>
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)', width: '100%' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#2c2f31', marginRight: '8px' }}>檢視：</span>
            <button
              onClick={() => props.setReviewFilter('all')}
              style={filterBtnStyle(props.reviewFilter === 'all')}
            >
              全部 ({props.results.length})
            </button>
            <button
              onClick={() => props.setReviewFilter('pending')}
              style={filterBtnStyle(props.reviewFilter === 'pending')}
            >
              待複核 ({pendingCount})
            </button>
            <button
              onClick={() => props.setReviewFilter('low')}
              style={filterBtnStyle(props.reviewFilter === 'low')}
            >
              低信心待確認 ({lowConfidenceCount})
            </button>

            <div style={{ width: '1px', height: '24px', background: 'rgba(0,0,0,0.1)', margin: '0 8px' }} />

            <button
              onClick={() => props.setIsTopTwentyView(v => !v)}
              style={filterBtnStyle(props.isTopTwentyView)}
            >
              Top 20 預覽
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {lowConfidenceCount > 0 && (
              <button
                onClick={onLowerThreshold}
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(180, 25, 36, 0.2)',
                  color: '#b41924',
                  background: 'rgba(180, 25, 36, 0.05)',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(180, 25, 36, 0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(180, 25, 36, 0.05)'}
              >
                放寬門檻重試低信心項目
              </button>
            )}
             <button
              onClick={() => setCompactView(v => !v)}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                color: '#595c5e',
                background: 'rgba(255,255,255,0.6)',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'background 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.9)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.6)'}
            >
              {compactView ? '切換至詳細模式' : '切換至簡潔模式'}
            </button>
          </div>
        </div>
      </div>

      {/* Virtualized Grid */}"""

content = re.sub(header_pattern, new_header, content)

with open("src/renderer/components/ResultsSection.tsx", "w", encoding="utf-8") as f:
    f.write(content)
