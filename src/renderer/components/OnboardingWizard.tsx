/**
 * 任務導向首次導覽
 * 聚焦「先做什麼」與「下一步怎麼補救」
 */
import React, { useMemo, useState } from 'react';
import { theme } from '../styles/theme';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  reassurance?: string;
  tips: string[];
}

interface FirstRunChecklist {
  hasRefs: boolean;
  hasFolder: boolean;
  modelLoaded: boolean | null;
}

interface OnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
  checklist?: FirstRunChecklist;
}

const steps: OnboardingStep[] = [
  {
    id: 'refs',
    title: '先準備參考照',
    description: '先放 3-5 張清晰正面照就好，之後可以再補。',
    icon: '📸',
    reassurance: '先求有結果，不用一次就做到完美。',
    tips: [
      '建議使用光線好、臉部清楚的照片',
      '可混合不同角度，提升找回率',
      '如果結果少，再補 2-3 張通常會變好',
    ],
  },
  {
    id: 'folder',
    title: '再選照片資料夾',
    description: '可以直接丟班級照或活動照資料夾，會自動遞迴掃描。',
    icon: '📁',
    reassurance: '資料夾很大也可以，過程中可暫停或取消。',
    tips: [
      '先從最常用的相簿開始',
      '第一次先跑一輪，之後再微調門檻',
      '掃描中可看進度，不用猜還要多久',
    ],
  },
  {
    id: 'scan',
    title: '開始搜尋與複核',
    description: '先跑出候選照片，再用「低信心提醒」快速複核。',
    icon: '🔎',
    reassurance: '看起來不確定的照片，先標記待複核即可。',
    tips: [
      '門檻 0.55-0.65 是常用起點',
      '低信心結果先看大圖再決定',
      '可用收藏功能先保留高價值照片',
    ],
  },
  {
    id: 'export',
    title: '匯出與補救',
    description: '可先匯出，再重試失敗項目，不會讓你重來全部流程。',
    icon: '📦',
    reassurance: '真的不用急，先完成第一版結果最重要。',
    tips: [
      '匯出失敗可只重試失敗清單',
      '找不到時先放寬門檻或補參考照',
      '上次設定可直接載入，重跑更快',
    ],
  },
];

export function OnboardingWizard({ onComplete, onSkip, checklist }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isFinalStep = currentStep === steps.length - 1;
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const checklistRows = useMemo(() => {
    if (!checklist) return [];
    return [
      {
        label: '已準備參考照',
        ok: checklist.hasRefs,
        pendingText: '先放 3 張即可開始',
      },
      {
        label: '已選擇照片資料夾',
        ok: checklist.hasFolder,
        pendingText: '先選一個常用相簿',
      },
      {
        label: '模型狀態',
        ok: checklist.modelLoaded === true,
        pendingText: checklist.modelLoaded === null ? '初始化中' : '尚未就緒，先載入參考照可觸發',
      },
    ];
  }, [checklist]);

  const finish = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    onComplete?.();
  };

  const handleNext = () => {
    if (isFinalStep) {
      finish();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    onSkip?.();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div style={{ width: '100%', maxWidth: 680, padding: theme.spacing[6] }}>
        <div
          style={{
            height: 6,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 999,
            overflow: 'hidden',
            marginBottom: theme.spacing[2],
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #60a5fa 0%, #34d399 100%)',
              transition: 'width 180ms ease',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: 'rgba(255,255,255,0.72)',
            fontSize: theme.typography.fontSize.xs,
            marginBottom: theme.spacing[4],
          }}
        >
          <span>步驟 {currentStep + 1} / {steps.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.09)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: theme.borderRadius.xl,
            padding: theme.spacing[6],
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: theme.spacing[5] }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                margin: `0 auto ${theme.spacing[3]}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: 34,
                background: 'linear-gradient(135deg, rgba(96,165,250,0.8), rgba(52,211,153,0.8))',
              }}
            >
              {step.icon}
            </div>
            <h2
              style={{
                margin: 0,
                marginBottom: theme.spacing[2],
                color: theme.colors.neutral[0],
                fontSize: theme.typography.fontSize['2xl'],
              }}
            >
              {step.title}
            </h2>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.82)', lineHeight: 1.65 }}>{step.description}</p>
            {step.reassurance && (
              <p style={{ margin: `${theme.spacing[3]} 0 0`, color: '#bbf7d0', fontSize: theme.typography.fontSize.sm }}>
                {step.reassurance}
              </p>
            )}
          </div>

          <div
            style={{
              background: 'rgba(0,0,0,0.16)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing[4],
              marginBottom: theme.spacing[4],
            }}
          >
            <div
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: '#93c5fd',
                fontWeight: theme.typography.fontWeight.semibold,
                marginBottom: theme.spacing[2],
              }}
            >
              小提醒
            </div>
            <ul style={{ margin: 0, paddingLeft: theme.spacing[5], color: 'rgba(255,255,255,0.84)', lineHeight: 1.65 }}>
              {step.tips.map((tip) => (
                <li key={tip} style={{ marginBottom: theme.spacing[1] }}>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {isFinalStep && checklistRows.length > 0 && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.62)',
                border: '1px solid rgba(148,163,184,0.35)',
                borderRadius: theme.borderRadius.lg,
                padding: theme.spacing[4],
              }}
            >
              <div
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: theme.typography.fontWeight.semibold,
                  marginBottom: theme.spacing[2],
                }}
              >
                啟動前檢查
              </div>
              {checklistRows.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: `${theme.spacing[1]} 0`,
                    color: 'rgba(255,255,255,0.86)',
                    fontSize: theme.typography.fontSize.sm,
                  }}
                >
                  <span>{row.label}</span>
                  <span style={{ color: row.ok ? '#86efac' : '#fcd34d' }}>
                    {row.ok ? '已就緒' : row.pendingText}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: theme.spacing[4], display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={handleSkip}
            style={{
              borderRadius: theme.borderRadius.md,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.85)',
              padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
              cursor: 'pointer',
            }}
          >
            跳過，先直接使用
          </button>
          <div style={{ display: 'flex', gap: theme.spacing[2] }}>
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.9)',
                  padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                  cursor: 'pointer',
                }}
              >
                上一步
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                borderRadius: theme.borderRadius.md,
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #14b8a6 100%)',
                color: '#fff',
                padding: `${theme.spacing[2]} ${theme.spacing[5]}`,
                fontWeight: theme.typography.fontWeight.semibold,
                cursor: 'pointer',
              }}
            >
              {isFinalStep ? '完成，開始使用' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
