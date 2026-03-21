/**
 * 參考照片質量卡片組建
 * 顯示單張參考照片及其質量評估結果
 */

import React, { useCallback } from 'react';
import { GlassCard } from './GlassCard';
import { ModernButton } from './ModernButton';
import { ImagePreview } from './ImagePreview';
import { theme } from '../styles/theme';
import type { QualityMetrics } from '@core/childQualityAssessment';

interface ReferencePhotoQualityProps {
  photoPath: string;
  quality?: QualityMetrics;
  isProcessing?: boolean;
  onEnhance?: (path: string) => void;
  onRemove?: (path: string) => void;
}

export function ReferencePhotoQualityCard({
  photoPath,
  quality,
  isProcessing = false,
  onEnhance,
  onRemove
}: ReferencePhotoQualityProps) {
  const qualityScore = quality?.overallScore ?? 50;
  const isGoodQuality = qualityScore >= 70;
  const isWarningQuality = qualityScore >= 50 && qualityScore < 70;

  const getQualityColor = () => {
    if (isGoodQuality) return theme.colors.success[500];
    if (isWarningQuality) return theme.colors.warning[500];
    return theme.colors.error[500];
  };

  const getQualityLabel = () => {
    if (isGoodQuality) return '良好';
    if (isWarningQuality) return '一般';
    return '較差';
  };

  const _getEnhancementSuggestions = useCallback(() => {
    if (!quality?.recommendations) return [];
    return quality.recommendations;
  }, [quality]);

  return (
    <GlassCard
      padding="md"
      hover
      glow
    >
      <div style={{ display: 'flex', gap: theme.spacing[3] }}>
        {/* 缩略图 */}
        <div style={{ flex: '0 0 100px' }}>
          <div style={{ position: 'relative', width: '100px', height: '100px' }}>
            <ImagePreview
              src={`file://${photoPath.replace(/\\/g, '/')}`}
              alt="Reference"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: theme.borderRadius.md
              }}
            />
            {/* 质量徽章 */}
            <div
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: getQualityColor(),
                color: theme.colors.neutral[0],
                padding: '2px 8px',
                borderRadius: theme.borderRadius.full,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.semibold,
                boxShadow: theme.shadows.glass
              }}
            >
              {qualityScore}
            </div>
          </div>
        </div>

        {/* 信息 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[2] }}>
            <div style={{ minWidth: 0 }}>
              <h4 style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                margin: 0,
                color: theme.colors.neutral[100],
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                參考照片 {photoPath.split(/[/\\]/).pop()}
              </h4>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                margin: 0,
                color: theme.colors.neutral[500]
              }}>
                質量評分：{qualityScore}/100 ({getQualityLabel()})
              </p>
            </div>
          </div>

          {/* 指标详情 */}
          {quality && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: theme.spacing[2],
              marginBottom: theme.spacing[3]
            }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  display: 'block',
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.neutral[500]
                }}>銳度</span>
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: theme.colors.primary[500]
                }}>{quality.sharpness}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  display: 'block',
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.neutral[500]
                }}>亮度</span>
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: theme.colors.primary[500]
                }}>{quality.exposure}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  display: 'block',
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.neutral[500]
                }}>分辨率</span>
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: theme.colors.primary[500]
                }}>{quality.resolution}</span>
              </div>
            </div>
          )}

          {/* 建议列表 */}
          {quality?.recommendations && quality.recommendations.length > 0 && (
            <div style={{
              marginBottom: theme.spacing[3],
              padding: theme.spacing[3],
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: theme.borderRadius.md
            }}>
              {quality.recommendations.slice(0, 2).map((rec, idx) => (
                <p key={idx} style={{
                  fontSize: theme.typography.fontSize.xs,
                  margin: 0,
                  color: theme.colors.neutral[300],
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[1]
                }}>
                  <span>💡</span>
                  {rec}
                </p>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: theme.spacing[2] }}>
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => onEnhance?.(photoPath)}
              disabled={isProcessing || !onEnhance}
              style={{
                fontSize: theme.typography.fontSize.xs
              }}
            >
              ✨ 智能增強
            </ModernButton>
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => onRemove?.(photoPath)}
              disabled={isProcessing}
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.error[600]
              }}
            >
              🗑️ 移除
            </ModernButton>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/**
 * 批量质量评估结果汇总
 */
interface QualitySummaryProps {
  total: number;
  goodCount: number;
  warningCount: number;
  poorCount: number;
  avgScore: number;
}

export function QualitySummary({ total: _total, goodCount, warningCount, poorCount, avgScore }: QualitySummaryProps) {
  return (
    <GlassCard padding="lg" style={{ display: 'flex', gap: theme.spacing[4] }}>
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
          background: theme.gradients.primary,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          {avgScore.toFixed(0)}/100
        </div>
        <div style={{
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.neutral[500]
        }}>
          平均質量
        </div>
      </div>

      <div style={{ flex: 2 }}>
        <div style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium, marginBottom: theme.spacing[2] }}>
          質量分佈
        </div>
        <div style={{ display: 'flex', gap: theme.spacing[2] }}>
          <div style={{
            flex: 1,
            padding: theme.spacing[3],
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: theme.borderRadius.md,
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.success[600]
            }}>{goodCount}</div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.success[600]
            }}>良好</div>
          </div>
          <div style={{
            flex: 1,
            padding: theme.spacing[3],
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: theme.borderRadius.md,
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.warning[600]
            }}>{warningCount}</div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.warning[600]
            }}>一般</div>
          </div>
          <div style={{
            flex: 1,
            padding: theme.spacing[3],
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: theme.borderRadius.md,
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.error[600]
            }}>{poorCount}</div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.error[600]
            }}>較差</div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
