import re

def modify_swipe_review():
    with open('src/renderer/components/SwipeReview.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # The goal is to replace the JSX returned by the component to match the Stitch design.
    # We will keep the logic, just change the styles and layout structure.

    # 1. Update the "All done" view
    all_done_pattern = r'if \(!current \|\| remaining === 0\) \{[\s\S]*?return \([\s\S]*?<div style=\{\{[\s\S]*?\}\}>[\s\S]*?<div style=\{\{ fontSize: \'48px\', marginBottom: \'16px\' \}\}>🎉</div>[\s\S]*?<h2 style=\{\{ margin: 0, fontSize: \'24px\', fontWeight: 700 \}\}>全部審核完畢！</h2>[\s\S]*?<p style=\{\{ color: \'rgba\(255,255,255,0\.6\)\', marginTop: \'8px\' \}\}>[\s\S]*?已審核 \{Object\.keys\(reviewDecisions\)\.length\} 張照片[\s\S]*?</p>[\s\S]*?<button[\s\S]*?>[\s\S]*?返回結果[\s\S]*?</button>[\s\S]*?</div>[\s\S]*?\);[\s\S]*?\}'

    new_all_done = """if (!current || remaining === 0) {
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
    content = re.sub(all_done_pattern, new_all_done, content)


    # 2. Update the main return JSX
    main_jsx_pattern = r'return \([\s\S]*?<div[\s\S]*?style=\{\{[\s\S]*?position: \'fixed\', inset: 0, zIndex: 9999,[\s\S]*?background: \'rgba\(0,0,0,0\.9\)\',[\s\S]*?\}\}[\s\S]*?>[\s\S]*?\{/\* Top bar \*/\}[\s\S]*?<div style=\{\{[\s\S]*?\}\}>[\s\S]*?<button[\s\S]*?>[\s\S]*?✕ 關閉[\s\S]*?</button>[\s\S]*?<span>剩餘 \{remaining\} 張</span>[\s\S]*?<span style=\{\{ fontSize: \'12px\', opacity: 0\.5 \}\}>← 不要 \| 要 →</span>[\s\S]*?</div>[\s\S]*?\{/\* Card area \*/\}[\s\S]*?<div[\s\S]*?>[\s\S]*?\{/\* Swipe indicators \*/\}[\s\S]*?\{dragX > 30 && \([\s\S]*?\}\)[\s\S]*?\{dragX < -30 && \([\s\S]*?\}\)[\s\S]*?\{/\* Card \*/\}[\s\S]*?<div[\s\S]*?ref=\{cardRef\}[\s\S]*?style=\{\{[\s\S]*?\}\}[\s\S]*?>[\s\S]*?\{/\* Photo \*/\}[\s\S]*?<div style=\{\{[\s\S]*?\}\}>[\s\S]*?<img[\s\S]*?/>[\s\S]*?\{/\* Score badge \*/\}[\s\S]*?<div style=\{\{[\s\S]*?\}\}>[\s\S]*?\{score\}%[\s\S]*?</div>[\s\S]*?</div>[\s\S]*?\{/\* Info bar \*/\}[\s\S]*?<div style=\{\{[\s\S]*?\}\}>[\s\S]*?<span[\s\S]*?>[\s\S]*?\{current\.path\.split\(/\[/\\\\\]/\)\.pop\(\)\}[\s\S]*?</span>[\s\S]*?\{current\.source && current\.source !== \'face\' && \([\s\S]*?\}\)[\s\S]*?</div>[\s\S]*?</div>[\s\S]*?</div>[\s\S]*?\{/\* Bottom buttons \*/\}[\s\S]*?<div style=\{\{[\s\S]*?\}\}>[\s\S]*?<button[\s\S]*?>[\s\S]*?✕[\s\S]*?</button>[\s\S]*?<button[\s\S]*?>[\s\S]*?↓[\s\S]*?</button>[\s\S]*?<button[\s\S]*?>[\s\S]*?✓[\s\S]*?</button>[\s\S]*?</div>[\s\S]*?</div>[\s\S]*?\);'

    new_main_jsx = """return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(135deg, #f5f7f9 0%, #eef1f3 100%)',
        display: 'flex', flexDirection: 'row',
        userSelect: 'none',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Sidebar */}
      <div style={{
        width: '280px',
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.3)',
        display: 'flex', flexDirection: 'column',
        padding: '32px 24px',
        color: '#2c2f31'
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 700, margin: '0 0 40px 0', color: '#006a28' }}>
            照片審核
          </h1>

          <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.6)', padding: '16px', borderRadius: '16px' }}>
            <div style={{ fontSize: '14px', color: '#595c5e', marginBottom: '4px' }}>已審核</div>
            <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {Object.keys(reviewDecisions).length}
            </div>
          </div>

          <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.6)', padding: '16px', borderRadius: '16px' }}>
            <div style={{ fontSize: '14px', color: '#595c5e', marginBottom: '4px' }}>剩餘</div>
            <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {remaining}
            </div>
          </div>

           <div style={{ fontSize: '13px', color: '#9a9d9f', marginTop: '40px', lineHeight: '1.6' }}>
            提示：您可以滑動照片，<br/>或使用鍵盤左右鍵。<br/><br/>
            ← 不要&nbsp;&nbsp;&nbsp;&nbsp;要 →
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.8)',
            border: 'none',
            color: '#595c5e',
            padding: '12px 24px',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'background 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#ffffff'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.8)'}
        >
          暫停並返回
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>

        {/* Card area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            padding: '20px',
          }}
          onMouseDown={(e) => handleDragStart(e.clientX)}
          onMouseMove={(e) => handleDragMove(e.clientX)}
          onMouseUp={handleDragEnd}
          onMouseLeave={() => { if (isDragging) handleDragEnd(); }}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
          onTouchEnd={handleDragEnd}
        >
          {/* Swipe indicators */}
          {dragX > 30 && (
            <div style={{
              position: 'absolute', right: '10%', top: '50%', transform: 'translateY(-50%)',
              fontSize: '120px', opacity: Math.min(0.3, dragX / 300),
              transition: 'opacity 0.1s',
              color: '#006a28'
            }}>✓</div>
          )}
          {dragX < -30 && (
            <div style={{
              position: 'absolute', left: '10%', top: '50%', transform: 'translateY(-50%)',
              fontSize: '120px', opacity: Math.min(0.3, Math.abs(dragX) / 300),
              transition: 'opacity 0.1s',
              color: '#b41924'
            }}>✕</div>
          )}

          {/* Card */}
          <div
            ref={cardRef}
            style={{
              width: '100%',
              maxWidth: '600px',
              height: '75vh',
              maxHeight: '800px',
              borderRadius: '24px',
              overflow: 'visible',
              background: '#ffffff',
              boxShadow: '0 24px 48px rgba(0,0,0,0.08)',
              transform: cardTransform,
              opacity,
              transition: swipeDirection ? 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out' : isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              cursor: isDragging ? 'grabbing' : 'grab',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
             {/* Score badge (Floating above card) */}
             <div style={{
                position: 'absolute',
                top: '-20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: score >= 70 ? 'rgba(92, 253, 128, 0.9)' : score >= 50 ? 'rgba(242, 136, 255, 0.9)' : 'rgba(255, 195, 191, 0.9)',
                color: score >= 70 ? '#004819' : score >= 50 ? '#2f0038' : '#70000d',
                padding: '8px 24px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '18px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                zIndex: 10,
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                {score}% 相似
              </div>

            {/* Photo */}
            <div style={{
              width: '100%',
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              background: '#eef1f3',
              borderRadius: '24px 24px 0 0',
            }}>
              <img
                src={imgSrc}
                alt=""
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* Info bar */}
            <div style={{
              padding: '20px 24px',
              color: '#595c5e',
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#ffffff',
              borderRadius: '0 0 24px 24px'
            }}>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '80%'
              }}>
                {current.path.split(/[/\\]/).pop()}
              </span>
              {current.source && current.source !== 'face' && (
                <span style={{
                  fontSize: '12px',
                  color: '#b41924',
                  flexShrink: 0,
                  marginLeft: '12px',
                  background: 'rgba(180, 25, 36, 0.1)',
                  padding: '4px 8px',
                  borderRadius: '12px'
                }}>
                  ⚠ 非臉部比對
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '48px',
          padding: '24px 20px 48px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => handleDecision('rejected')}
            style={{
              width: '88px', height: '88px',
              borderRadius: '50%',
              border: 'none',
              background: '#b41924',
              color: '#ffefee',
              fontSize: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 12px 24px rgba(180, 25, 36, 0.3)'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseDown={(e) => { e.stopPropagation(); }}
            title="不要 (← 或 A)"
          >
            ✕
          </button>
          <button
            onClick={() => {
              if (currentIndex < pendingResults.length - 1) {
                setCurrentIndex(i => i + 1);
              }
            }}
            style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              border: 'none',
              background: '#ffffff',
              color: '#595c5e',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              boxShadow: '0 8px 16px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseDown={(e) => { e.stopPropagation(); }}
            title="跳過 (↓ 或 S)"
          >
            ↓
          </button>
          <button
            onClick={() => handleDecision('accepted')}
            style={{
              width: '88px', height: '88px',
              borderRadius: '50%',
              border: 'none',
              background: '#006a28',
              color: '#cfffce',
              fontSize: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 12px 24px rgba(0, 106, 40, 0.3)'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseDown={(e) => { e.stopPropagation(); }}
            title="要 (→ 或 D)"
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  );"""

    content = re.sub(main_jsx_pattern, new_main_jsx, content)

    with open('src/renderer/components/SwipeReview.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_swipe_review()
