/**
 * Modern Status Badge Component
 * Features gradient backgrounds and smooth animations
 */

import React from 'react';
import { theme, animations } from '../styles/theme';

interface StatusBadgeProps {
  status: 'idle' | 'processing' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function StatusBadge({
  status,
  children,
  size = 'md',
  animated = true
}: StatusBadgeProps) {
  const getStatusStyles = (): React.CSSProperties => {
    const sizeMap = {
      sm: { padding: `${theme.spacing[1]} ${theme.spacing[3]}`, fontSize: theme.typography.fontSize.xs },
      md: { padding: `${theme.spacing[2]} ${theme.spacing[4]}`, fontSize: theme.typography.fontSize.sm },
      lg: { padding: `${theme.spacing[3]} ${theme.spacing[6]}`, fontSize: theme.typography.fontSize.base },
    };

    const statusStyles = {
      idle: {
        background: 'rgba(148, 163, 184, 0.1)',
        color: theme.colors.secondary[600],
        border: '1px solid rgba(148, 163, 184, 0.2)',
      },
      processing: {
        background: 'rgba(245, 158, 11, 0.1)',
        color: theme.colors.warning[600],
        border: '1px solid rgba(245, 158, 11, 0.2)',
      },
      success: {
        background: 'rgba(34, 197, 94, 0.1)',
        color: theme.colors.success[600],
        border: '1px solid rgba(34, 197, 94, 0.2)',
      },
      warning: {
        background: 'rgba(245, 158, 11, 0.1)',
        color: theme.colors.warning[600],
        border: '1px solid rgba(245, 158, 11, 0.2)',
      },
      error: {
        background: 'rgba(239, 68, 68, 0.1)',
        color: theme.colors.error[600],
        border: '1px solid rgba(239, 68, 68, 0.2)',
      },
    };

    return {
      ...sizeMap[size],
      ...statusStyles[status],
      borderRadius: theme.borderRadius.full,
      fontWeight: theme.typography.fontWeight.medium,
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing[2],
      transition: `all ${theme.transition.base} ${theme.easing.easeInOut}`,
      ...(animated && status === 'processing' && {
        animation: 'pulse 2s infinite',
      }),
    };
  };

  const getStatusIcon = () => {
    const iconSize = size === 'sm' ? '12px' : size === 'lg' ? '20px' : '16px';
    
    switch (status) {
      case 'processing':
        return (
          <div
            style={{
              width: iconSize,
              height: iconSize,
              border: '2px solid currentColor',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        );
      case 'success':
        return (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 00016zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 0l-2 2a1 1 0 001.414 1.414L8 12.414l2.293 2.293a1 1 0 001.414-1.414l-2-2z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 00016zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div style={getStatusStyles()}>
      {getStatusIcon()}
      {children}
      
      <style>{animations + `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}