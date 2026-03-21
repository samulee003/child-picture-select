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
        border: '1px solid rgba(245, 158, 11, 0.35)',
        background: 'rgba(245, 158, 11, 0.08)',
        padding: theme.spacing[3],
        color: '#92400e',
        fontSize: theme.typography.fontSize.sm,
      }}
    >
      {warnings.map((item) => (
        <div key={item}>- {item}</div>
      ))}
    </div>
  );
}
