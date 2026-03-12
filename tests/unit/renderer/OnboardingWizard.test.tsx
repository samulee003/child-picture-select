import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom

/**
 * OnboardingWizard 元件測試
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingWizard } from '../../../src/renderer/components/OnboardingWizard';

describe('OnboardingWizard', () => {
  it('should render first step correctly', () => {
    render(<OnboardingWizard />);

    expect(screen.getByText('歡迎使用 大海撈Ｂ')).toBeInTheDocument();
    expect(screen.getByText('👋')).toBeInTheDocument();
    expect(screen.getByText('步驟 1 / 5')).toBeInTheDocument();
  });

  it('should navigate to next step', () => {
    render(<OnboardingWizard />);

    const nextButton = screen.getByText('下一步');
    fireEvent.click(nextButton);

    expect(screen.getByText('準備參考照片')).toBeInTheDocument();
    expect(screen.getByText('📸')).toBeInTheDocument();
    expect(screen.getByText('步驟 2 / 5')).toBeInTheDocument();
  });

  it('should navigate through all steps', () => {
    render(<OnboardingWizard />);

    const nextButton = screen.getByText('下一步');
    
    // Click through all steps
    fireEvent.click(nextButton); // Step 2
    fireEvent.click(nextButton); // Step 3
    fireEvent.click(nextButton); // Step 4
    fireEvent.click(nextButton); // Step 5

    expect(screen.getByText('完成！')).toBeInTheDocument();
    expect(screen.getByText('🎉')).toBeInTheDocument();
    expect(screen.getByText('步驟 5 / 5')).toBeInTheDocument();
  });

  it('should call onComplete on final step', () => {
    const onComplete = vi.fn();
    render(<OnboardingWizard onComplete={onComplete} />);

    const nextButton = screen.getByText('下一步');
    
    // Navigate to last step
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    // Click "開始使用" on final step
    const startButton = screen.getByText('開始使用');
    fireEvent.click(startButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('onboardingCompleted')).toBe('true');
  });

  it('should call onSkip when skip button is clicked', () => {
    const onSkip = vi.fn();
    render(<OnboardingWizard onSkip={onSkip} />);

    const skipButton = screen.getByText('跳過引導');
    fireEvent.click(skipButton);

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('onboardingCompleted')).toBe('true');
  });

  it('should navigate back with previous button', () => {
    render(<OnboardingWizard />);

    const nextButton = screen.getByText('下一步');
    fireEvent.click(nextButton);

    // Previous button should appear on step 2
    const prevButton = screen.getByText('上一步');
    fireEvent.click(prevButton);

    expect(screen.getByText('步驟 1 / 5')).toBeInTheDocument();
  });

  it('should not show previous button on first step', () => {
    render(<OnboardingWizard />);

    expect(screen.queryByText('上一步')).not.toBeInTheDocument();
  });

  it('should display tips for each step', () => {
    render(<OnboardingWizard />);

    expect(screen.getByText('💡 小提示')).toBeInTheDocument();
    expect(screen.getByText('完全離線處理，照片不會上傳到雲端')).toBeInTheDocument();
  });

  it('should update progress bar correctly', () => {
    render(<OnboardingWizard />);

    // Initial progress: 20% (1/5)
    expect(screen.getByText('20%')).toBeInTheDocument();

    const nextButton = screen.getByText('下一步');
    fireEvent.click(nextButton);

    // Progress: 40% (2/5)
    expect(screen.getByText('40%')).toBeInTheDocument();
  });
});
