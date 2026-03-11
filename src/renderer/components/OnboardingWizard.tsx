/**
 * 影像式導引系統 - 幫助首次用戶快速上手
 */

import React, { useState, useEffect } from 'react';
import { theme } from '../styles/theme';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  tips?: string[];
  exampleImages?: string[];
  reassurance?: string;
}

const steps: OnboardingStep[] = [
  {
    title: '歡迎使用 大海撈「B」',
    description: '從班級/團體照中快速找出特定孩子的照片',
    icon: '👋',
    reassurance: '不用怕，第一次上手照步驟走完就能看到結果，不用一次就做到完美。',
    tips: [
      '完全離線處理，照片不會上傳到雲端',
      'AI 人臉辨識技術，準確率超過 90%',
      '3 分鐘內即可完成第一次搜尋'
    ]
  },
  {
    title: '準備參考照片',
    description: '找 3-5 張孩子的清晰照片，建議包含不同角度',
    icon: '📸',
    reassurance: '不用怕，參考照先放 3 張也可以，結果不滿意再補一張就行。',
    tips: [
      '選擇光線充足、面部清晰的照片',
      '包含正面、側面等不同角度',
      '避免模糊、背光或遮擋的照片',
      '支持 JPG、PNG、HEIC 等格式'
    ],
    exampleImages: []
  },
  {
    title: '選擇照片資料夾',
    description: '選擇包含班級照或家庭聚會照的資料夾',
    icon: '📁',
    reassurance: '不用怕，大資料夾也能處理，先點選資料夾後先做第一輪結果再微調。',
    tips: [
      '可以選擇包含數百張照片的資料夾',
      '支援子資料夾遞迴掃描',
      '處理速度：約 100 張照片/3-5 秒'
    ]
  },
  {
    title: '開始搜尋',
    description: '點擊按鈕，AI 會幫您找出孩子出現的照片',
    icon: '🔍',
    tips: [
      '相似度門檻建議設為 0.55-0.65',
      '結果按相似度從高到低排序',
      '可以點擊照片查看大圖確認'
    ]
  },
  {
    title: '完成！',
    description: '查看結果並匯出匹配的照片',
    icon: '🎉',
    tips: [
      '可以匯出所有匹配照片到新資料夾',
      '結果會自動儲存，下次可直接查看',
      '隨時可以開始新的搜尋任務'
    ]
  }
];

interface OnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isFinalStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      localStorage.setItem('onboardingCompleted', 'true');
      onComplete?.();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    onSkip?.();
  };

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
    <style>{`
      @keyframes onboarding-fade {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }

      @keyframes onboarding-slideUp {
        0% { opacity: 0; transform: translateY(22px) scale(0.98); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes onboarding-iconPop {
        0% { transform: scale(0.6) rotate(-8deg); opacity: 0.2; }
        70% { transform: scale(1.12) rotate(2deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg); }
      }

      @keyframes onboarding-fadeInUp {
        0% { opacity: 0; transform: translateY(14px); }
        100% { opacity: 1; transform: translateY(0); }
      }

      @keyframes onboarding-shimmer {
        0% { background-position: 120% 0; }
        100% { background-position: -120% 0; }
      }
    `}</style>
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'onboarding-fade 0.35s ease-out',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        padding: theme.spacing[6],
      }}>
        {/* Progress Bar */}
        <div style={{
          marginBottom: theme.spacing[6],
        }}>
        <div style={{
            height: '6px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: theme.borderRadius.full,
            overflow: 'hidden',
          animation: 'onboarding-shimmer 1.8s linear infinite',
          backgroundSize: '200% 100%',
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.28), rgba(255,255,255,0.05))',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              borderRadius: theme.borderRadius.full,
              transition: 'width 0.3s ease-out',
            }} />
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: theme.spacing[2],
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.neutral[400],
          }}>
            <span>步驟 {currentStep + 1} / {steps.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Content Card */}
        <div key={currentStep} style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: theme.borderRadius['2xl'],
          padding: theme.spacing[8],
          textAlign: 'center',
          animation: 'onboarding-slideUp 0.5s ease-out',
        }}>
          {/* Icon */}
          <div style={{
            width: '100px',
            height: '100px',
            margin: `0 auto ${theme.spacing[6]}`,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            animation: 'onboarding-iconPop 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            {step.icon}
          </div>

          {/* Title */}
          <h2 style={{
            margin: `0 0 ${theme.spacing[3]}`,
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.neutral[100],
          }}>
            {step.title}
          </h2>

          {/* Description */}
          <p style={{
            margin: `0 0 ${theme.spacing[6]}`,
            fontSize: theme.typography.fontSize.lg,
            color: theme.colors.neutral[300],
            lineHeight: 1.6,
          }}>
            {step.description}
          </p>

          {step.reassurance && (
            <p style={{
              margin: `0 0 ${theme.spacing[5]}`,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              color: '#86efac',
              lineHeight: 1.7,
            }}>
              {step.reassurance}
            </p>
          )}

          {/* Tips */}
          {step.tips && step.tips.length > 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing[4],
              marginBottom: theme.spacing[6],
              textAlign: 'left',
            }}>
              <h4 style={{
                margin: `0 0 ${theme.spacing[3]}`,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.primary[400],
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                💡 小提示
              </h4>
              <ul style={{
                margin: 0,
                paddingLeft: theme.spacing[5],
                listStyle: 'none',
              }}>
                {step.tips.map((tip, idx) => (
                <li key={idx} style={{
                  animation: 'onboarding-fadeInUp 0.4s ease-out',
                  animationDelay: `${idx * 85}ms`,
                  animationFillMode: 'both',
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.neutral[300],
                    marginBottom: theme.spacing[2],
                    lineHeight: 1.5,
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute',
                      left: `-${theme.spacing[5]}`,
                      color: theme.colors.primary[400],
                    }}>•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: theme.spacing[6],
        }}>
          <button
            onClick={handleSkip}
            style={{
              padding: `${theme.spacing[3]} ${theme.spacing[6]}`,
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: theme.borderRadius.lg,
              color: theme.colors.neutral[300],
              fontSize: theme.typography.fontSize.sm,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            跳過引導
          </button>

          <div style={{ display: 'flex', gap: theme.spacing[3] }}>
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[6]}`,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: theme.borderRadius.lg,
                  color: theme.colors.neutral[200],
                  fontSize: theme.typography.fontSize.sm,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  animation: 'onboarding-fadeInUp 0.3s ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                上一步
              </button>
            )}

            <button
              onClick={handleNext}
              style={{
                padding: `${theme.spacing[3]} ${theme.spacing[8]}`,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: theme.borderRadius.lg,
                color: theme.colors.neutral[0],
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                animation: 'onboarding-fadeInUp 0.32s ease-out',
                animationDelay: `${currentStep > 0 ? 120 : 220}ms`,
                animationFillMode: 'both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
              }}
            >
              {isFinalStep ? '開始使用' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
