import React from 'react';
import { theme } from '../styles/theme';

interface ScanWarningsPanelProps {
  warnings: string[];
}

export function ScanWarningsPanel({ warnings }: ScanWarningsPanelProps) {
  if (!warnings.length) return null;
  return (
    <div
      style={{
        marginTop: theme.spacing[3],
        borderRadius: theme.borderRadius.md,
        border: '1px solid rgba(245, 158, 11, 0.3)',
        background: 'rgba(245, 158, 11, 0.15)',
        padding: theme.spacing[3],
        color: '#fbbf24',
        fontSize: theme.typography.fontSize.sm,
      }}
    >
      {warnings.map((item) => (
        <div key={item}>- {item}</div>
      ))}
    </div>
  );
}
