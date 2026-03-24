import re

with open("src/renderer/components/OnboardingWizard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# We want to replace the `return (...)` block of OnboardingWizard
start_idx = content.find("  return (")

new_return = """  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 15, 16, 0.4)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: '640px',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(32px)',
        borderRadius: '32px',
        padding: '48px',
        boxShadow: '0 32px 64px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.5)',
      }}>
        {/* Progress Bar */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '14px',
            color: '#595c5e',
            marginBottom: '12px',
            fontWeight: 600
          }}>
            <span>步驟 {currentStep + 1} / {steps.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{
            height: '8px',
            background: 'rgba(0,0,0,0.05)',
            borderRadius: '999px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: '#006a28',
              borderRadius: '999px',
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
          </div>
        </div>

        {/* Content Area */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontSize: '64px',
            lineHeight: 1,
            marginBottom: '24px',
            filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))'
          }}>
            {step.icon}
          </div>
          <h2 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '32px',
            color: '#2c2f31',
            marginBottom: '16px',
            fontWeight: 700,
            letterSpacing: '-0.02em'
          }}>
            {step.title}
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#595c5e',
            lineHeight: 1.6,
            margin: 0
          }}>
            {step.description}
          </p>
          {step.reassurance && (
            <p style={{
              marginTop: '12px',
              color: '#006a28',
              fontSize: '15px',
              fontWeight: 600
            }}>
              ✨ {step.reassurance}
            </p>
          )}
        </div>

        {/* Tips Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.5)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '40px',
          border: '1px solid rgba(255,255,255,0.8)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '16px',
            color: '#006a28',
            fontWeight: 700,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            小提醒
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: '24px',
            color: '#2c2f31',
            lineHeight: 1.7,
            fontSize: '15px'
          }}>
            {step.tips.map((tip) => (
              <li key={tip} style={{ marginBottom: '8px' }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Final Step Checklist */}
        {isFinalStep && checklistRows.length > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '40px',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '16px',
              color: '#2c2f31',
              fontWeight: 700,
              marginBottom: '16px'
            }}>
              啟動前檢查
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {checklistRows.map((row) => (
                <div key={row.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: '12px',
                  fontSize: '15px'
                }}>
                  <span style={{ color: '#595c5e', fontWeight: 500 }}>{row.label}</span>
                  <span style={{
                    color: row.ok ? '#006a28' : '#b41924',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {row.ok ? '✓' : '⚠'} {row.ok ? '已就緒' : row.pendingText}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handleSkip}
            style={{
              padding: '16px 24px',
              borderRadius: '999px',
              border: 'none',
              background: 'transparent',
              color: '#595c5e',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            跳過，直接使用
          </button>

          <div style={{ display: 'flex', gap: '16px' }}>
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  padding: '16px 32px',
                  borderRadius: '999px',
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: 'rgba(255,255,255,0.5)',
                  color: '#2c2f31',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.8)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.5)'}
              >
                上一步
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                padding: '16px 40px',
                borderRadius: '999px',
                border: 'none',
                background: '#006a28',
                color: '#cfffce',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0, 106, 40, 0.25)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isFinalStep ? '完成，開始使用' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
"""

new_content = content[:start_idx] + new_return
with open("src/renderer/components/OnboardingWizard.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)
