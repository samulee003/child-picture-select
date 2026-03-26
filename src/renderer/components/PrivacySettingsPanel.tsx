/**
 * 隱私設定面板
 */

import React, { useState, useEffect } from 'react';
import { safeLocalStorageSet } from '../../utils/safe-storage';
import { theme } from '../styles/theme';
import { GlassCard } from './GlassCard';

interface PrivacySettings {
  enableEncryption: boolean;
  autoClearHistory: boolean;
  clearHistoryDays: number;
  showPrivacyBadge: boolean;
}

const defaultSettings: PrivacySettings = {
  enableEncryption: true,
  autoClearHistory: false,
  clearHistoryDays: 30,
  showPrivacyBadge: true,
};

interface PrivacySettingsPanelProps {
  onClose?: () => void;
  onDeleteAllData?: () => void | Promise<void>;
  onExportAllData?: () => void | Promise<void>;
}

export function PrivacySettingsPanel({ onClose, onDeleteAllData, onExportAllData }: PrivacySettingsPanelProps) {
  const [settings, setSettings] = useState<PrivacySettings>(() => {
    const saved = localStorage.getItem('privacy-settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    safeLocalStorageSet('privacy-settings', JSON.stringify(settings));
    if (settings.autoClearHistory && window.api && (window.api as any).clearOldSessions) {
      (window.api as any).clearOldSessions(settings.clearHistoryDays).catch(() => {});
    }
  }, [settings]);

  const updateSetting = <K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9998,
      animation: 'fadeIn 0.2s ease-out',
    }} onClick={onClose}>
        <GlassCard
        padding="xl"
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          animation: 'scaleIn 0.3s ease-out',
        }}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing[6],
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.neutral[100],
            }}>
              🔒 隱私設定
            </h2>
            <p style={{
              margin: `${theme.spacing[2]} 0 0`,
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.neutral[400],
            }}>
              保護您的資料安全
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.neutral[400],
              fontSize: '24px',
              cursor: 'pointer',
              padding: theme.spacing[2],
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Privacy Badge Info */}
        <GlassCard
          padding="md"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            marginBottom: theme.spacing[6],
          }}
        >
          <div style={{ display: 'flex', gap: theme.spacing[3] }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'rgba(16, 185, 129, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
            }}>
              🛡️
            </div>
            <div>
              <h4 style={{
                margin: `0 0 ${theme.spacing[1]}`,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.success[400],
              }}>
                隱私保護承諾
              </h4>
              <ul style={{
                margin: 0,
                paddingLeft: theme.spacing[4],
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.neutral[300],
                lineHeight: 1.6,
              }}>
                <li>照片不會上傳到網際網路</li>
                <li>所有 AI 處理都在本機執行</li>
                <li>特徵向量加密儲存</li>
                <li>沒有追蹤、沒有廣告</li>
              </ul>
            </div>
          </div>
        </GlassCard>

        {/* Settings */}
        <div style={{ marginBottom: theme.spacing[6] }}>
          {/* Enable Encryption */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${theme.spacing[4]} 0`,
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <div>
              <div style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.neutral[200],
                marginBottom: theme.spacing[1],
              }}>
                🔐 資料加密儲存
              </div>
              <div style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.neutral[400],
              }}>
                使用 AES-256 加密敏感資料
              </div>
            </div>
            <ToggleSwitch
              checked={settings.enableEncryption}
              onChange={v => updateSetting('enableEncryption', v)}
            />
          </div>

          {/* Auto Clear History */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${theme.spacing[4]} 0`,
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <div>
              <div style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.neutral[200],
                marginBottom: theme.spacing[1],
              }}>
                🗑️ 自動清理歷史記錄
              </div>
              <div style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.neutral[400],
              }}>
                定期清理掃描歷史
              </div>
            </div>
            <ToggleSwitch
              checked={settings.autoClearHistory}
              onChange={v => updateSetting('autoClearHistory', v)}
            />
          </div>

          {/* Clear History Days */}
          {settings.autoClearHistory && (
            <div style={{
              padding: `${theme.spacing[4]} 0`,
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              <label style={{
                display: 'block',
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.neutral[300],
                marginBottom: theme.spacing[2],
              }}>
                清理天数：{settings.clearHistoryDays} 天
              </label>
              <input
                type="range"
                min={7}
                max={90}
                step={7}
                value={settings.clearHistoryDays}
                onChange={e => updateSetting('clearHistoryDays', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: theme.borderRadius.full,
                  outline: 'none',
                  appearance: 'none',
                }}
              />
            </div>
          )}

          {/* Show Privacy Badge */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${theme.spacing[4]} 0`,
          }}>
            <div>
              <div style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.neutral[200],
                marginBottom: theme.spacing[1],
              }}>
                👁️ 顯示隱私保護徽章
              </div>
              <div style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.neutral[400],
              }}>
                在主介面顯示隱私保護資訊
              </div>
            </div>
            <ToggleSwitch
              checked={settings.showPrivacyBadge}
              onChange={v => updateSetting('showPrivacyBadge', v)}
            />
          </div>
        </div>

        {/* Export Data */}
        <GlassCard
          padding="md"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <h4 style={{
            margin: `0 0 ${theme.spacing[3]}`,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.neutral[200],
          }}>
            📤 資料管理
          </h4>
          <div style={{
            display: 'flex',
            gap: theme.spacing[3],
            flexWrap: 'wrap',
          }}>
            <button
              onClick={onExportAllData}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                background: 'rgba(102, 126, 234, 0.2)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                borderRadius: theme.borderRadius.md,
                color: theme.colors.primary[300],
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                cursor: onExportAllData ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                opacity: onExportAllData ? 1 : 0.5,
              }}
              onMouseEnter={e => {
                if (onExportAllData) e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
              }}
            >
              ⬇️ 匯出所有資料
            </button>
            <button
              onClick={onDeleteAllData}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: theme.borderRadius.md,
                color: theme.colors.error[300],
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                cursor: onDeleteAllData ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                opacity: onDeleteAllData ? 1 : 0.5,
              }}
              onMouseEnter={e => {
                if (onDeleteAllData) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              }}
            >
              ⚠️ 刪除所有資料
            </button>
          </div>
        </GlassCard>
      </GlassCard>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '44px',
        height: '24px',
        background: checked
          ? 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
          : 'rgba(255, 255, 255, 0.1)',
        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s',
        padding: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '2px',
        left: checked ? '22px' : '2px',
        width: '20px',
        height: '20px',
        background: 'white',
        borderRadius: '50%',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.2s',
      }} />
    </button>
  );
}
