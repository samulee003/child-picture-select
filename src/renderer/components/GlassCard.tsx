/**
 * Modern Glass Card Component
 * Features glassmorphism effect with blur and transparency
 */

import React from 'react';
import { modernStyles, theme } from '../styles/theme';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  glow?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function GlassCard({
  children,
  className = '',
  style = {},
  padding = 'md',
  hover = false,
  glow = false,
  onClick
}: GlassCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const getCardStyles = (): React.CSSProperties => {
    const paddingMap = {
      sm: theme.spacing[4],
      md: theme.spacing[6],
      lg: theme.spacing[8],
      xl: theme.spacing[10],
    };

    return {
      ...modernStyles.glassCard,
      padding: paddingMap[padding],
      transition: `all ${theme.transition.base} ${theme.easing.easeInOut}`,
      transform: hover && isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
      ...(glow && {
        boxShadow: isHovered 
          ? '0 20px 40px rgba(102, 126, 234, 0.3), 0 0 20px rgba(102, 126, 234, 0.2)'
          : theme.shadows.glass,
      }),
      ...style,
    };
  };

  return (
    <div
      className={`glass-card ${className}`}
      style={getCardStyles()}
      onMouseEnter={() => hover && setIsHovered(true)}
      onMouseLeave={() => hover && setIsHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}