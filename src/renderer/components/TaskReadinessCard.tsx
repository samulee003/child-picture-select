import React from 'react';
import { GlassCard } from './GlassCard';
import { theme } from '../styles/theme';

interface TaskReadinessItem {
  label: string;
  ok: boolean;
  pending: string;
}

interface TaskReadinessCardProps {
  items: TaskReadinessItem[];
}

export function TaskReadinessCard({ items }: TaskReadinessCardProps) {
  return (
    <GlassCard
      padding="md"
      style={{
        background: 'rgba(14, 116, 144, 0.08)',
        border: '1px solid rgba(14, 116, 144, 0.25)',
      }}
    >
      <div
        style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.neutral[800],
          marginBottom: theme.spacing[2],
        }}
      >
        任務前置檢查
      </div>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing[1],
          }}
        >
          <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.neutral[700] }}>{item.label}</span>
          <span style={{ fontSize: theme.typography.fontSize.xs, color: item.ok ? '#16a34a' : '#b45309' }}>
            {item.ok ? '已就緒' : item.pending}
          </span>
        </div>
      ))}
    </GlassCard>
  );
}
