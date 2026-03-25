with open("src/renderer/components/ScanControls.tsx", "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("  return (")

new_return = r"""  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
      marginTop: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <button
        onClick={handlePause}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 24px',
          borderRadius: '999px',
          border: 'none',
          background: paused ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          color: paused ? '#006a28' : '#b45309',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'transform 0.2s, background 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {paused ? '▶ 繼續掃描' : '⏸ 暫停掃描'}
      </button>

      <button
        onClick={handleCancel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 24px',
          borderRadius: '999px',
          border: 'none',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#b41924',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'transform 0.2s, background 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        ✕ 停止並取消
      </button>
    </div>
  );
}
"""

new_content = content[:start_idx] + new_return
with open("src/renderer/components/ScanControls.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)
