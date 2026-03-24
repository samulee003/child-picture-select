import re

with open("src/renderer/components/WelcomeState.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# We want to replace the return statement with the new design
# The old return statement:
# return (
#   <div style={{
#     flex: 1,
#     display: 'flex', ...

idx = content.find("  return (")

new_return = """  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(24px)',
        padding: '56px 48px',
        borderRadius: '32px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.05)',
        maxWidth: '560px',
        width: '100%',
        textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.4)',
      }}>
        <img
          src="logo.png"
          alt="Logo"
          style={{
            width: '96px',
            height: '96px',
            margin: '0 auto 32px',
            opacity: 0.9,
            borderRadius: '24px',
            boxShadow: '0 12px 24px rgba(0,0,0,0.08)'
          }}
        />
        <h2 style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '32px',
          color: '#006a28',
          marginBottom: '40px',
          fontWeight: 700,
          letterSpacing: '-0.02em'
        }}>
          三步驟找到你的寶貝照片
        </h2>

        <div style={{ textAlign: 'left', marginBottom: '48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {steps.map(item => (
            <div key={item.step} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '20px',
              padding: '16px 24px',
              background: item.done ? 'rgba(92, 253, 128, 0.1)' : 'rgba(255,255,255,0.5)',
              borderRadius: '20px',
              border: item.done ? '1px solid rgba(0, 106, 40, 0.1)' : '1px solid transparent',
              transition: 'background 0.3s'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: item.done ? '#006a28' : (item.step === 1 ? '#006a28' : item.step === 2 ? '#b41924' : '#595c5e'),
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '16px',
                flexShrink: 0,
                marginTop: '2px',
                boxShadow: item.done ? '0 4px 12px rgba(0, 106, 40, 0.3)' : 'none'
              }}>
                {item.done ? '✓' : item.step}
              </div>
              <div>
                <div style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '18px',
                  fontWeight: 600,
                  color: item.done ? '#006a28' : '#2c2f31',
                  marginBottom: '4px'
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: '15px',
                  color: '#595c5e',
                  lineHeight: '1.5'
                }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!hasRefs ? (
            <button
              onClick={onBrowseFiles}
              style={{
                width: '100%',
                padding: '20px',
                borderRadius: '9999px',
                border: 'none',
                background: '#006a28',
                color: '#cfffce',
                fontSize: '18px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 12px 24px rgba(0, 106, 40, 0.25)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              選擇小孩的照片
            </button>
          ) : !hasFolder ? (
            <button
              onClick={onBrowseFolder}
              style={{
                width: '100%',
                padding: '20px',
                borderRadius: '9999px',
                border: 'none',
                background: '#006a28',
                color: '#cfffce',
                fontSize: '18px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 12px 24px rgba(0, 106, 40, 0.25)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              選擇照片資料夾
            </button>
          ) : (
            <button
              onClick={onRunScan}
              disabled={isProcessing}
              style={{
                width: '100%',
                padding: '20px',
                borderRadius: '9999px',
                border: 'none',
                background: isProcessing ? '#9a9d9f' : '#00C853',
                color: isProcessing ? '#ffffff' : '#004819',
                fontSize: '18px',
                fontWeight: 700,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: isProcessing ? 'none' : '0 12px 24px rgba(0, 200, 83, 0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseOver={e => { if(!isProcessing) e.currentTarget.style.transform = 'scale(1.02)' }}
              onMouseOut={e => { if(!isProcessing) e.currentTarget.style.transform = 'scale(1)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {isProcessing ? '處理中...' : '開始搜尋'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
"""

new_content = content[:idx] + new_return
with open("src/renderer/components/WelcomeState.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)
