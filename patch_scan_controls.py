import re

with open("src/renderer/components/ScanControls.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the ModernButton and structure with Lumina Glass pill buttons and glowing progress bar
start_idx = content.find("  return (")

new_return = r"""  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(24px)',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.05)',
      border: '1px solid rgba(255,255,255,0.5)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{
          margin: 0,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '20px',
          color: '#2c2f31',
          fontWeight: 700
        }}>
          掃描進度
        </h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          {isScanning && !isPaused && (
             <button
              onClick={onPause}
              style={{
                padding: '10px 24px',
                borderRadius: '999px',
                border: 'none',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#d97706',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'}
            >
              ⏸ 暫停
            </button>
          )}
          {isScanning && isPaused && (
             <button
              onClick={onResume}
              style={{
                padding: '10px 24px',
                borderRadius: '999px',
                border: 'none',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#059669',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
            >
              ▶ 繼續
            </button>
          )}
          <button
            onClick={onCancel}
            disabled={!isScanning}
            style={{
              padding: '10px 24px',
              borderRadius: '999px',
              border: 'none',
              background: !isScanning ? 'rgba(0,0,0,0.05)' : 'rgba(239, 68, 68, 0.1)',
              color: !isScanning ? '#9a9d9f' : '#dc2626',
              fontSize: '14px',
              fontWeight: 600,
              cursor: !isScanning ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseOver={e => { if(isScanning) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}}
            onMouseOut={e => { if(isScanning) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}}
          >
            ✕ 停止
          </button>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#595c5e', fontWeight: 500 }}>
           <span>{progressText}</span>
           <span>{timeEstimate}</span>
         </div>
         <div style={{
           height: '8px',
           background: 'rgba(0,0,0,0.05)',
           borderRadius: '999px',
           overflow: 'hidden'
         }}>
           <div style={{
             width: `${Math.max(0, Math.min(100, progressPercent))}%`,
             height: '100%',
             background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
             borderRadius: '999px',
             transition: 'width 0.4s ease-out'
           }} />
         </div>
      </div>
    </div>
  );
}
"""

new_content = content[:start_idx] + new_return
with open("src/renderer/components/ScanControls.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)
