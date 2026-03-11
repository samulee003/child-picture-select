/**
 * Modern Progress Bar Component
 * Features gradient fill, smooth animations, and percentage display
 */

import React from 'react';
import { theme, animations } from '../styles/theme';

interface ModernProgressProps {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning';
  animated?: boolean;
}

export function ModernProgress({
  value,
  max,
  label,
  showPercentage = true,
  size = 'md',
  color = 'primary',
  animated = true
}: ModernProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const sizeMap = {
    sm: { height: '4px', fontSize: '10px' },
    md: { height: '8px', fontSize: '12px' },
    lg: { height: '12px', fontSize: '14px' },
  };

  const colorMap = {
    primary: theme.gradients.primary,
    success: theme.gradients.success,
    warning: theme.gradients.secondary,
  };

  const currentSize = sizeMap[size];
  const currentColor = colorMap[color];

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing[2],
          fontSize: currentSize.fontSize,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.neutral[600],
        }}>
          <span>{label}</span>
          {showPercentage && (
            <span style={{
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.neutral[800],
            }}>
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      
      <div style={{
        position: 'relative',
        width: '100%',
        height: currentSize.height,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: theme.borderRadius.full,
        overflow: 'hidden',
      }}>
        {/* Animated background shimmer */}
        {animated && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
            animation: 'shimmer 2s infinite',
          }} />
        )}
        
        {/* Progress fill */}
        <div style={{
          height: '100%',
          width: `${percentage}%`,
          background: currentColor,
          borderRadius: theme.borderRadius.full,
          transition: `width ${theme.transition.slow} ${theme.easing.easeOut}`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Glow effect */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
            animation: 'pulse 2s infinite',
          }} />
        </div>
      </div>
      
      <style>{animations + `
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}