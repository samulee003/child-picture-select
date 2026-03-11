/**
 * Modern Animated Button Component
 * Features hover effects, loading states, and smooth transitions
 */

import React from 'react';
import { modernStyles, theme } from '../styles/theme';

interface ModernButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function ModernButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  style = {},
  icon,
  fullWidth = false
}: ModernButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  const getButtonStyles = (): React.CSSProperties => {
    const baseStyles = {
      ...modernStyles.button.base,
      ...(variant === 'primary' && modernStyles.button.primary),
      ...(variant === 'secondary' && modernStyles.button.secondary),
      ...(variant === 'success' && modernStyles.button.success),
      ...(variant === 'ghost' && modernStyles.button.ghost),
      ...(disabled && {
        opacity: 0.5,
        cursor: 'not-allowed',
        transform: 'none !important',
      }),
      ...(isHovered && !disabled && !loading && {
        ...(variant === 'primary' && modernStyles.button.primaryHover),
        ...(variant === 'secondary' && modernStyles.button.secondaryHover),
        ...(variant === 'ghost' && modernStyles.button.ghostHover),
      }),
      ...(isPressed && !disabled && !loading && {
        transform: 'translateY(1px) scale(0.98)',
      }),
      ...(fullWidth && { width: '100%' }),
      ...(size === 'sm' && {
        padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
        fontSize: theme.typography.fontSize.xs,
      }),
      ...(size === 'lg' && {
        padding: `${theme.spacing[4]} ${theme.spacing[8]}`,
        fontSize: theme.typography.fontSize.lg,
      }),
      ...style,
    };

    return baseStyles as React.CSSProperties;
  };

  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      setIsPressed(true);
      setTimeout(() => setIsPressed(false), 150);
      onClick();
    }
  };

  return (
    <button
      className={`modern-button ${className}`}
      style={getButtonStyles()}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled || loading}
    >
      {loading && (
        <div
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTop: '2px solid currentColor',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      )}
      {!loading && icon && (
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
      )}
      <span>{children}</span>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}