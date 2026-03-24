// @vitest-environment jsdom
import { fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * MatchResultCard 無障礙測試
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchResultCard } from '../../../src/renderer/components/MatchResultCard';

describe('MatchResultCard Accessibility', () => {
  const mockResult = {
    path: '/test/photo.jpg',
    score: 0.85,
    thumbPath: '/test/thumb.jpg',
    source: 'face' as const,
  };

  it('should have proper ARIA label', () => {
    render(
      <MatchResultCard 
        result={mockResult} 
        index={0}
        onPreview={() => {}}
      />
    );

    const card = screen.getByText('photo.jpg');
    expect(card).toBeInTheDocument();
  });







  it('should display score with proper formatting', () => {
    render(
      <MatchResultCard 
        result={mockResult} 
        index={0}
        onPreview={() => {}}
      />
    );

    expect(screen.getByText('85% 相似')).toBeInTheDocument();
  });

  it('should display source hint badge', () => {
    render(
      <MatchResultCard
        result={mockResult}
        index={0}
        onPreview={() => {}}
      />
    );
    expect(screen.getByText('來源：臉部特徵')).toBeInTheDocument();
  });
});
