import React from 'react';
import { GlassCard } from './GlassCard';
import { ModernButton } from './ModernButton';
import { theme } from '../styles/theme';

interface WelcomeStateProps {
  refPaths: string;
  folder: string;
  isProcessing: boolean;
  onBrowseFiles: () => void;
  onBrowseFolder: () => void;
  onRunScan: () => void;
}

export function WelcomeState({
  refPaths,
  folder,
  isProcessing,
  onBrowseFiles,
  onBrowseFolder,
  onRunScan,
}: WelcomeStateProps) {
  const hasRefs = refPaths.split(/\r?\n/).filter(s => s.trim()).length > 0;
  const hasFolder = folder.trim().length > 0;

  const steps = [
    {
      step: 1,
      label: '選擇小孩的照片',
      desc: '3-10 張清晰正面照作為參考',
      done: hasRefs,
      color: theme.colors.primary[500],
    },
    {
      step: 2,
      label: '選擇要搜尋的資料夾',
      desc: '班級照、活動照的資料夾',
      done: hasFolder,
      color: theme.colors.secondary[500],
    },
    {
      step: 3,
      label: '按「開始搜尋」',
      desc: 'AI 會自動找出你的小孩',
      done: false,
      color: '#10b981',
    },
  ];

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <GlassCard padding="xl" style={{ textAlign: 'center', maxWidth: '520px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <img
          src="logo.png"
          alt="Logo"
          style={{
            width: '80px',
            height: '80px',
            margin: '0 auto',
            marginBottom: theme.spacing[5],
            opacity: 0.9,
            borderRadius: theme.spacing[3],
          }}
        />
        <h2 style={{
          fontSize: theme.typography.fontSize['2xl'],
          color: theme.colors.primary[300],
          marginBottom: theme.spacing[5],
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          三步驟找到你的寶貝照片
        </h2>
        <div style={{ textAlign: 'left', marginBottom: theme.spacing[5] }}>
          {steps.map(item => (
            <div key={item.step} style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[3],
              padding: `${theme.spacing[3]} 0`,
              borderBottom: item.step < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: item.done ? '#10b981' : item.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: theme.typography.fontSize.sm,
                flexShrink: 0,
              }}>
                {item.done ? '✓' : item.step}
              </div>
              <div>
                <div style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: item.done ? '#10b981' : theme.colors.neutral[100],
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.neutral[300],
                }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
        {!hasRefs ? (
          <ModernButton
            variant="primary" size="lg" fullWidth
            onClick={onBrowseFiles}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            }
          >
            選擇小孩的照片
          </ModernButton>
        ) : !hasFolder ? (
          <ModernButton
            variant="primary" size="lg" fullWidth
            onClick={onBrowseFolder}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            }
          >
            選擇照片資料夾
          </ModernButton>
        ) : (
          <ModernButton
            variant="success" size="lg" fullWidth
            onClick={onRunScan}
            disabled={isProcessing}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            }
          >
            開始搜尋
          </ModernButton>
        )}
      </GlassCard>
    </div>
  );
}
