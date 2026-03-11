/**
 * 新手引導嚮組件
 * 幫助用戶快速上手並配置最佳設置
 */

import React, { useState } from 'react';

interface SetupWizardProps {
  isOpen: boolean;
  onComplete: (config: WizardConfig) => void;
  onCancel: () => void;
}

interface WizardConfig {
  experience: 'beginner' | 'intermediate' | 'advanced';
  childAgeRange: { min: number; max: number };
  photoQuality: 'high' | 'medium' | 'low';
  processingMode: 'speed' | 'quality' | 'balanced';
  autoThreshold: boolean;
}

const setupWizardStyles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  } as React.CSSProperties,
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '600px',
    maxHeight: '80vh',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    position: 'relative'
  } as React.CSSProperties,
  header: {
    textAlign: 'center',
    marginBottom: '24px'
  } as React.CSSProperties,
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: 0
  } as React.CSSProperties,
  subtitle: {
    fontSize: '16px',
    color: '#666',
    marginTop: '8px'
  } as React.CSSProperties,
  stepIndicator: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px'
  } as React.CSSProperties,
  stepDot: (index: number, currentStep: number) => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: index === currentStep ? '#4a90e2' : '#e2e8f0',
    margin: '0 4px'
  }),
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  } as React.CSSProperties,
  primaryButton: {
    backgroundColor: '#4a90e2',
    color: 'white'
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    color: 'white'
  },
  optionCard: {
    padding: '16px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  } as React.CSSProperties,
  optionCardSelected: {
    borderColor: '#4a90e2',
    backgroundColor: '#f0f8ff'
  },
  radio: {
    marginRight: '8px'
  } as React.CSSProperties,
  label: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#333'
  } as React.CSSProperties,
  description: {
    fontSize: '12px',
    color: '#666',
    lineHeight: '1.4'
  } as React.CSSProperties
};

export function SetupWizard({ isOpen, onComplete, onCancel }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<WizardConfig>({
    experience: 'beginner',
    childAgeRange: { min: 3, max: 12 },
    photoQuality: 'medium',
    processingMode: 'balanced',
    autoThreshold: true
  });

  const steps = [
    {
      id: 'experience',
      title: '使用經驗級別',
      description: '選擇最適合您的使用經驗級別',
      component: ExperienceStep
    },
    {
      id: 'age-range',
      title: '設定孩子年齡範圍',
      description: '設定您要找尋的孩子的年齡範圍',
      component: AgeRangeStep
    },
    {
      id: 'photo-quality',
      title: '照片質量要求',
      description: '設定參考照片的質量要求',
      component: PhotoQualityStep
    },
    {
      id: 'processing-mode',
      title: '處理模式',
      description: '選擇處理速度和質量的平衡',
      component: ProcessingModeStep
    },
    {
      id: 'summary',
      title: '配置確認',
      description: '確認您的設置並開始使用',
      component: SummaryStep
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    onComplete(config);
  };

  const handleCancel = () => {
    onCancel();
  };

  const updateConfig = (updates: Partial<WizardConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const currentStepData = steps[currentStep];

  if (!isOpen) return null;

  return (
    <div style={setupWizardStyles.container}>
      <div style={setupWizardStyles.modal}>
        <div style={setupWizardStyles.header}>
          <h1 style={setupWizardStyles.title}>🚀 歡迎使用 大海撈「B」</h1>
          <p style={setupWizardStyles.subtitle}>讓我們幫助您快速配置最佳設置</p>
        </div>

        <div style={setupWizardStyles.stepIndicator}>
          {steps.map((step, index) => (
            <div
              key={step.id}
              style={setupWizardStyles.stepDot(index, currentStep)}
              title={step.title}
            />
          ))}
        </div>

        <h2 style={{ ...setupWizardStyles.title, textAlign: 'left', marginBottom: '16px' }}>
          {currentStepData.title}
        </h2>
        <p style={setupWizardStyles.description}>
          {currentStepData.description}
        </p>

        {currentStep === 0 && (
          <ExperienceStep
            config={config}
            updateConfig={updateConfig}
            onNext={handleNext}
          />
        )}

        {currentStep === 1 && (
          <AgeRangeStep
            config={config}
            updateConfig={updateConfig}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}

        {currentStep === 2 && (
          <PhotoQualityStep
            config={config}
            updateConfig={updateConfig}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}

        {currentStep === 3 && (
          <ProcessingModeStep
            config={config}
            updateConfig={updateConfig}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )}

        {currentStep === 4 && (
          <SummaryStep
            config={config}
            onPrevious={handlePrevious}
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          <button
            style={currentStep === 0 ? setupWizardStyles.secondaryButton : setupWizardStyles.button}
            onClick={currentStep === 0 ? handleCancel : handlePrevious}
            disabled={currentStep === 0}
          >
            {currentStep === 0 ? '取消' : '上一步'}
          </button>
          
          <button
            style={currentStep === 4 ? setupWizardStyles.primaryButton : (currentStep === 0 ? setupWizardStyles.secondaryButton : setupWizardStyles.button)}
            onClick={currentStep === 4 ? handleComplete : handleNext}
            disabled={currentStep === 0}
          >
            {currentStep === 4 ? '開始使用' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 經驗級別選擇組件
function ExperienceStep({ config, updateConfig, onNext }: {
  config: WizardConfig;
  updateConfig: (updates: Partial<WizardConfig>) => void;
  onNext: () => void;
}) {
  const experienceLevels = [
    {
      id: 'beginner',
      title: '👶 新手',
      description: '適合第一次使用，簡單易用',
      settings: {
        autoThreshold: true,
        processingMode: 'speed',
        childAgeRange: { min: 3, max: 12 }
      }
    },
    {
      id: 'intermediate',
      title: '🔧 進階用戶',
      description: '有使用經驗，需要更多控制選項',
      settings: {
        autoThreshold: true,
        processingMode: 'balanced',
        childAgeRange: { min: 2, max: 16 }
      }
    },
    {
      id: 'advanced',
      title: '⚙️ 專業用戶',
      description: '需要完全控制所有參數',
      settings: {
        autoThreshold: false,
        processingMode: 'quality',
        childAgeRange: { min: 0, max: 18 }
      }
    }
  ];

  return (
    <div>
      {experienceLevels.map((level) => (
        <div
          key={level.id}
          style={{
            ...setupWizardStyles.optionCard,
            ...((config.experience === level.id) ? setupWizardStyles.optionCardSelected : {})
          }}
          onClick={() => updateConfig({ experience: level.id as WizardConfig['experience'] })}
        >
          <div style={setupWizardStyles.radio}>
            <input
              type="radio"
              name="experience"
              value={level.id}
              checked={config.experience === level.id}
              onChange={() => updateConfig({ experience: level.id as WizardConfig['experience'] })}
              style={{ marginRight: '8px' }}
            />
            <label style={setupWizardStyles.label}>
              <strong>{level.title}</strong>
            </label>
          </div>
          <div style={setupWizardStyles.description}>
            {level.description}
          </div>
        </div>
      ))}
    </div>
  );
}

// 年齡範圍設定組件
function AgeRangeStep({ config, updateConfig, onNext, onPrevious }: {
  config: WizardConfig;
  updateConfig: (updates: Partial<WizardConfig>) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const ageRanges = [
    { id: 'toddler', label: '嬰兒期 (0-3歲)', min: 0, max: 3 },
    { id: 'preschool', label: '幼兒期 (3-6歲)', min: 3, max: 6 },
    { id: 'elementary', label: '兒童期 (6-12歲)', min: 6, max: 12 },
    { id: 'teenager', label: '青少年期 (13-18歲)', min: 13, max: 18 }
  ];

  return (
    <div>
      <h3 style={{ ...setupWizardStyles.title, textAlign: 'left', marginBottom: '16px' }}>選擇年齡範圍</h3>
      {ageRanges.map((range) => (
        <div
          key={range.id}
          style={{
            ...setupWizardStyles.optionCard,
            borderColor: config.childAgeRange.min === range.min && config.childAgeRange.max === range.max ? '#4a90e2' : '#e2e8f0'
          }}
          onClick={() => updateConfig({ 
            childAgeRange: { min: range.min, max: range.max } 
          })}
        >
          <div style={setupWizardStyles.radio}>
            <input
              type="radio"
              name="ageRange"
              value={range.id}
              checked={config.childAgeRange.min === range.min && config.childAgeRange.max === range.max}
              onChange={() => updateConfig({ 
                childAgeRange: { min: range.min, max: range.max } 
              })}
              style={setupWizardStyles.radio}
            />
            <label style={setupWizardStyles.label}>
              {range.label}
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

// 照片質量要求設定組件
function PhotoQualityStep({ config, updateConfig, onNext, onPrevious }: {
  config: WizardConfig;
  updateConfig: (updates: Partial<WizardConfig>) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const qualityLevels = [
    {
      id: 'high',
      title: '高質量',
      description: '清晰、光線充足、高分辨率照片',
      recommended: '推薦用於重要照片'
    },
    {
      id: 'medium',
      title: '中等質量',
      description: '一般質量的日常照片',
      recommended: '最常用的選擇'
    },
    {
      id: 'low',
      title: '低質量',
      description: '模糊、光線不佳的照片',
      recommended: '只在無法取得更好照片時使用'
    }
  ];

  return (
    <div>
      <h3 style={{ ...setupWizardStyles.title, textAlign: 'left', marginBottom: '16px' }}>照片質量要求</h3>
      {qualityLevels.map((level) => (
        <div
          key={level.id}
          style={{
            ...setupWizardStyles.optionCard,
            borderColor: config.photoQuality === level.id ? '#4a90e2' : '#e2e8f0'
          }}
          onClick={() => updateConfig({ photoQuality: level.id as WizardConfig['photoQuality'] })}
        >
          <div style={setupWizardStyles.radio}>
            <input
              type="radio"
              name="photoQuality"
              value={level.id}
              checked={config.photoQuality === level.id}
              onChange={() => updateConfig({ photoQuality: level.id as WizardConfig['photoQuality'] })}
              style={{ marginRight: '8px' }}
            />
            <label style={setupWizardStyles.label}>
              <strong>{level.title}</strong>
            </label>
          </div>
            <div style={setupWizardStyles.description}>
            {level.description}
          </div>
          {level.recommended && (
            <div style={{ ...setupWizardStyles.description, color: '#4a90e2', fontWeight: '600' }}>
              ⭐ {level.recommended}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 處理模式設定組件
function ProcessingModeStep({ config, updateConfig, onNext, onPrevious }: {
  config: WizardConfig;
  updateConfig: (updates: Partial<WizardConfig>) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const processingModes = [
    {
      id: 'speed',
      title: '⚡ 速度優先',
      description: '快速處理，適合大量照片',
      tradeoff: '準確率可能略低'
    },
    {
      id: 'balanced',
      title: '⚖️ 平衡模式',
      description: '速度和質量的平衡',
      tradeoff: '推薦給大多數用戶'
    },
    {
      id: 'quality',
      title: '🎯 質量優先',
      description: '最高準確率，處理速度較慢',
      tradeoff: '適合重要照片'
    }
  ];

  return (
    <div>
      <h3 style={{ ...setupWizardStyles.title, textAlign: 'left', marginBottom: '16px' }}>處理模式</h3>
      {processingModes.map((mode) => (
        <div
          key={mode.id}
          style={{
            ...setupWizardStyles.optionCard,
            borderColor: config.processingMode === mode.id ? '#4a90e2' : '#e2e8f0'
          }}
          onClick={() => updateConfig({ processingMode: mode.id as WizardConfig['processingMode'] })}
        >
          <div style={setupWizardStyles.radio}>
            <input
              type="radio"
              name="processingMode"
              value={mode.id}
              checked={config.processingMode === mode.id}
              onChange={() => updateConfig({ processingMode: mode.id as WizardConfig['processingMode'] })}
              style={{ marginRight: '8px' }}
            />
            <label style={setupWizardStyles.label}>
              <strong>{mode.title}</strong>
            </label>
          </div>
          <div style={setupWizardStyles.description}>
            {mode.description}
          </div>
          <div style={{ ...setupWizardStyles.description, color: '#666', fontStyle: 'italic' }}>
            權衡：{mode.tradeoff}
          </div>
        </div>
      ))}
    </div>
  );
}

// 配置確認組件
function SummaryStep({ 
  config, 
  onPrevious, 
  onComplete, 
  onCancel 
}: {
  config: WizardConfig;
  onPrevious: () => void;
  onComplete: (config: WizardConfig) => void;
  onCancel: () => void;
}) {
  const getExperienceText = (experience: string) => {
    const map = {
      beginner: '👶 新手',
      intermediate: '🔧 進階',
      advanced: '⚙️ 專業'
    };
    return map[experience as keyof typeof map] || experience;
  };

  const getQualityText = (quality: string) => {
    const map = {
      high: '🎯 高質量',
      medium: '📊 中等質量',
      low: '📱 低質量'
    };
    return map[quality as keyof typeof map] || quality;
  };

  const getModeText = (mode: string) => {
    const map = {
      speed: '⚡ 速度優先',
      balanced: '⚖️ 平衡模式',
      quality: '🎯 質量優先'
    };
    return map[mode as keyof typeof map] || mode;
  };

  return (
    <div>
      <h3 style={{ ...setupWizardStyles.title, textAlign: 'left', marginBottom: '16px' }}>配置確認</h3>
      
      <div style={{ ...setupWizardStyles.optionCard, marginBottom: '16px' }}>
        <h4 style={{ margin: 0, color: '#1a1a1a' }}>您的配置</h4>
        
        <div style={{ marginBottom: '12px' }}>
          <strong>使用經驗級別：</strong> {getExperienceText(config.experience)}
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong>年齡範圍：</strong> {config.childAgeRange.min} - {config.childAgeRange.max} 歲
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong>照片質量要求：</strong> {getQualityText(config.photoQuality)}
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong>處理模式：</strong> {getModeText(config.processingMode)}
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong>自動門檻：</strong> {config.autoThreshold ? '✅ 開啟' : '❌ 關閉'}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
        <button style={setupWizardStyles.secondaryButton} onClick={onPrevious}>
          上一步
        </button>
        
        <button style={setupWizardStyles.secondaryButton} onClick={onCancel}>
          取消
        </button>
        
        <button style={setupWizardStyles.primaryButton} onClick={() => onComplete(config)}>
          開始使用
        </button>
      </div>
    </div>
  );
}