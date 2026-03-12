/**
 * ScanControls - Pause/Resume and Cancel buttons during scanning
 */
import React, { useState } from 'react';

interface ScanControlsProps {
  onCancelled: () => void;
}

export function ScanControls({ onCancelled }: ScanControlsProps) {
  const [paused, setPaused] = useState(false);

  const handlePause = async () => {
    if (!window.api) return;
    if (paused) {
      await window.api.resumeScan();
      setPaused(false);
    } else {
      await window.api.pauseScan();
      setPaused(true);
    }
  };

  const handleCancel = async () => {
    if (!window.api) return;
    await window.api.cancelScan();
    setPaused(false);
    onCancelled();
  };

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      justifyContent: 'center',
      marginTop: '12px',
    }}>
      <button
        onClick={handlePause}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 18px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.15)',
          background: paused
            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
            : 'rgba(255,255,255,0.08)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {paused ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            繼續掃描
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            暫停
          </>
        )}
      </button>
      <button
        onClick={handleCancel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 18px',
          borderRadius: '8px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#fca5a5',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        取消掃描
      </button>
    </div>
  );
}
