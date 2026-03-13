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

    expect(screen.getByText('先準備參考照')).toBeInTheDocument();
    expect(screen.getByText('📸')).toBeInTheDocument();
    expect(screen.getByText('步驟 1 / 4')).toBeInTheDocument();
  });

  it('should navigate to next step', () => {
    render(<OnboardingWizard />);

    const nextButton = screen.getByText('下一步');
    fireEvent.click(nextButton);

    expect(screen.getByText('再選照片資料夾')).toBeInTheDocument();
    expect(screen.getByText('📁')).toBeInTheDocument();
    expect(screen.getByText('步驟 2 / 4')).toBeInTheDocument();
  });

  it('should navigate through all steps', () => {
    render(<OnboardingWizard />);

    const nextButton = screen.getByText('下一步');
    
    // Click through all steps
    fireEvent.click(nextButton); // Step 2
    fireEvent.click(nextButton); // Step 3
    fireEvent.click(nextButton); // Step 4

    expect(screen.getByText('匯出與補救')).toBeInTheDocument();
    expect(screen.getByText('📦')).toBeInTheDocument();
    expect(screen.getByText('步驟 4 / 4')).toBeInTheDocument();
  });

  it('should call onComplete on final step', () => {
    const onComplete = vi.fn();
    render(<OnboardingWizard onComplete={onComplete} />);

    const nextButton = screen.getByText('下一步');
    
    // Navigate to last step
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    // Click final CTA
    const startButton = screen.getByText('完成，開始使用');
    fireEvent.click(startButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('onboardingCompleted')).toBe('true');
  });

  it('should call onSkip when skip button is clicked', () => {
    const onSkip = vi.fn();
    render(<OnboardingWizard onSkip={onSkip} />);

    const skipButton = screen.getByText('跳過，先直接使用');
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

    expect(screen.getByText('步驟 1 / 4')).toBeInTheDocument();
  });

  it('should not show previous button on first step', () => {
    render(<OnboardingWizard />);

    expect(screen.queryByText('上一步')).not.toBeInTheDocument();
  });

  it('should display tips for each step', () => {
    render(<OnboardingWizard />);

    expect(screen.getByText('小提醒')).toBeInTheDocument();
    expect(screen.getByText('建議使用光線好、臉部清楚的照片')).toBeInTheDocument();
  });

  it('should update progress bar correctly', () => {
    render(<OnboardingWizard />);

    // Initial progress: 25% (1/4)
    expect(screen.getByText('25%')).toBeInTheDocument();

    const nextButton = screen.getByText('下一步');
    fireEvent.click(nextButton);

    // Progress: 50% (2/4)
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should render readiness checklist on final step', () => {
    render(
      <OnboardingWizard
        checklist={{ hasRefs: true, hasFolder: false, modelLoaded: true }}
      />
    );

    const nextButton = screen.getByText('下一步');
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(screen.getByText('啟動前檢查')).toBeInTheDocument();
    expect(screen.getByText('已準備參考照')).toBeInTheDocument();
    expect(screen.getByText('已選擇照片資料夾')).toBeInTheDocument();
    expect(screen.getByText('模型狀態')).toBeInTheDocument();
  });
});
