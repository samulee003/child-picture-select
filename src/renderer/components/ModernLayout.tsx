/**
 * Modern Layout Component
 * Responsive grid layout with glassmorphism effects
 */

import React from 'react';
import { theme, modernStyles, animations } from '../styles/theme';

interface ModernLayoutProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ModernLayout({ children, className = '', style = {} }: ModernLayoutProps) {
  return (
    <div
      className={`modern-layout ${className}`}
      style={{
        ...modernStyles.container,
        ...style,
      } as React.CSSProperties}
    >
      {/* Animated background elements */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        {/* Floating orbs */}
        <div
          style={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'float 6s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '60%',
            right: '15%',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(245, 87, 108, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'float 8s ease-in-out infinite reverse',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '20%',
            left: '20%',
            width: '150px',
            height: '150px',
            background: 'radial-gradient(circle, rgba(79, 172, 254, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'float 10s ease-in-out infinite',
          }}
        />
      </div>

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          ...modernStyles.layout,
        }}
      >
        {children}
      </div>

      <style>{animations}</style>
    </div>
  );
}

interface ModernSectionProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: string;
  className?: string;
  style?: React.CSSProperties;
  padding?: 'sm' | 'md' | 'lg';
}

export function ModernSection({
  children,
  title,
  description,
  className = '',
  style = {},
  padding = 'md'
}: ModernSectionProps) {
  const paddingMap = {
    sm: theme.spacing[4],
    md: theme.spacing[6],
    lg: theme.spacing[8],
  };

  return (
    <div
      className={`modern-section ${className}`}
      style={{
        animation: 'slideIn 0.5s ease-out',
        ...style,
      }}
    >
      {title && (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <h2
            style={{
              margin: 0,
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.neutral[100],
              marginBottom: theme.spacing[2],
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[3],
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              style={{
                margin: 0,
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.neutral[400],
                lineHeight: theme.typography.lineHeight.relaxed,
              }}
            >
              {description}
            </p>
          )}
        </div>
      )}
      
      <div style={{ padding: paddingMap[padding] }}>
        {children}
      </div>

      <style>{animations}</style>
    </div>
  );
}

interface ModernGridProps {
  children: React.ReactNode;
  columns?: number | 'auto';
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

export function ModernGrid({
  children,
  columns = 'auto',
  gap = 'md',
  className = '',
  style = {}
}: ModernGridProps) {
  const gapMap = {
    sm: theme.spacing[3],
    md: theme.spacing[4],
    lg: theme.spacing[6],
  };

  const gridTemplateColumns = columns === 'auto' 
    ? 'repeat(auto-fit, minmax(300px, 1fr))'
    : `repeat(${columns}, 1fr)`;

  return (
    <div
      className={`modern-grid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: gapMap[gap],
        ...style,
      }}
    >
      {children}
    </div>
  );
}