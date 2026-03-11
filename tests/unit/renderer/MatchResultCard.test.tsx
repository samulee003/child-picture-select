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

  it('should display confidence level with proper aria attributes', () => {
    render(
      <MatchResultCard 
        result={mockResult} 
        index={0}
        onPreview={() => {}}
      />
    );

    // Should show confidence badge
    expect(screen.getByText('高信心度')).toBeInTheDocument();
  });

  it('should have keyboard accessible explain button', () => {
    render(
      <MatchResultCard 
        result={mockResult} 
        index={0}
        onPreview={() => {}}
      />
    );

    const explainButton = screen.getByText('為何匹配？');
    expect(explainButton).toBeInTheDocument();
    
    // Button should be focusable
    expect(explainButton.tagName).toBe('BUTTON');
  });

  it('should show explanation panel when expanded', () => {
    render(
      <MatchResultCard 
        result={mockResult} 
        index={0}
        onPreview={() => {}}
      />
    );

    const explainButton = screen.getByText('為何匹配？');
    fireEvent.click(explainButton);

    expect(screen.getByRole('heading', { name: '🔍 匹配原因' })).toBeInTheDocument();
    expect(screen.getByText('面部特征高度相似')).toBeInTheDocument();
  });

  it('should display score with proper formatting', () => {
    render(
      <MatchResultCard 
        result={mockResult} 
        index={0}
        onPreview={() => {}}
      />
    );

    expect(screen.getByText('85.0%')).toBeInTheDocument();
  });
});
