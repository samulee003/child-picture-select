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
        background: 'rgba(92, 253, 128, 0.1)', border: '1px solid rgba(0, 106, 40, 0.1)', borderRadius: '16px', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.semibold,
          color: '#006a28',
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
          <span style={{ fontSize: theme.typography.fontSize.xs, color: '#595c5e' }}>{item.label}</span>
          <span style={{ fontSize: theme.typography.fontSize.xs, color: item.ok ? '#006a28' : '#b41924', fontWeight: 600 }}>
            {item.ok ? '已就緒' : item.pending}
          </span>
        </div>
      ))}
    </GlassCard>
  );
}
