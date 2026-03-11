/**
 * 无障碍工具函数
 * 符合 WCAG 2.1 AA 标准
 */

/**
 * ARIA 角色类型
 */
export type AriaRole =
  | 'alert'
  | 'alertdialog'
  | 'application'
  | 'article'
  | 'banner'
  | 'button'
  | 'checkbox'
  | 'columnheader'
  | 'combobox'
  | 'complementary'
  | 'contentinfo'
  | 'definition'
  | 'dialog'
  | 'directory'
  | 'document'
  | 'feed'
  | 'figure'
  | 'form'
  | 'grid'
  | 'gridcell'
  | 'group'
  | 'heading'
  | 'img'
  | 'link'
  | 'list'
  | 'listbox'
  | 'listitem'
  | 'log'
  | 'main'
  | 'marquee'
  | 'math'
  | 'menu'
  | 'menubar'
  | 'menuitem'
  | 'menuitemcheckbox'
  | 'menuitemradio'
  | 'navigation'
  | 'none'
  | 'note'
  | 'option'
  | 'presentation'
  | 'progressbar'
  | 'radio'
  | 'radiogroup'
  | 'region'
  | 'row'
  | 'rowgroup'
  | 'rowheader'
  | 'scrollbar'
  | 'search'
  | 'searchbox'
  | 'separator'
  | 'slider'
  | 'spinbutton'
  | 'status'
  | 'switch'
  | 'tab'
  | 'table'
  | 'tablist'
  | 'tabpanel'
  | 'term'
  | 'textbox'
  | 'timer'
  | 'toolbar'
  | 'tooltip'
  | 'tree'
  | 'treegrid'
  | 'treeitem';

/**
 * ARIA 属性接口
 */
export interface AriaAttributes {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-busy'?: boolean;
  'aria-controls'?: string;
  'aria-current'?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
  'aria-disabled'?: boolean;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-hidden'?: boolean;
  'aria-invalid'?: boolean | 'grammar' | 'spelling';
  'aria-keyshortcuts'?: string;
  'aria-modal'?: boolean;
  'aria-multiline'?: boolean;
  'aria-multiselectable'?: boolean;
  'aria-orientation'?: 'horizontal' | 'vertical';
  'aria-owns'?: string;
  'aria-placeholder'?: string;
  'aria-pressed'?: boolean | 'mixed';
  'aria-readonly'?: boolean;
  'aria-required'?: boolean;
  'aria-roledescription'?: string;
  'aria-selected'?: boolean;
  'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other';
  'aria-valuemax'?: number;
  'aria-valuemin'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
}

/**
 * 生成无障碍友好的属性对象
 */
export function createAriaProps(
  label?: string,
  describedBy?: string,
  live?: AriaAttributes['aria-live']
): AriaAttributes {
  const props: AriaAttributes = {};

  if (label) {
    props['aria-label'] = label;
  }

  if (describedBy) {
    props['aria-describedby'] = describedBy;
  }

  if (live) {
    props['aria-live'] = live;
  }

  return props;
}

/**
 * 键盘导航工具
 */
export interface KeyboardNavigationConfig {
  onEnter?: () => void;
  onSpace?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
}

/**
 * 建立鍵盤事件處理器
 */
export function createKeyboardHandler(
  config: KeyboardNavigationConfig
): (event: React.KeyboardEvent) => void {
  return (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
        config.onEnter?.();
        break;
      case ' ':
        event.preventDefault();
        config.onSpace?.();
        break;
      case 'Escape':
        config.onEscape?.();
        break;
      case 'ArrowUp':
        event.preventDefault();
        config.onArrowUp?.();
        break;
      case 'ArrowDown':
        event.preventDefault();
        config.onArrowDown?.();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        config.onArrowLeft?.();
        break;
      case 'ArrowRight':
        event.preventDefault();
        config.onArrowRight?.();
        break;
      case 'Tab':
        if (event.shiftKey) {
          config.onShiftTab?.();
        } else {
          config.onTab?.();
        }
        break;
    }
  };
}

/**
 * 焦点管理工具
 */
export class FocusManager {
  private previousFocus: HTMLElement | null = null;

  /**
   * 儲存目前焦點並聚焦到指定元素
   */
  focus(element: HTMLElement): void {
    this.previousFocus = document.activeElement as HTMLElement;
    element.focus();
  }

  /**
   * 恢復到先前的焦點
   */
  restore(): void {
    if (this.previousFocus) {
      this.previousFocus.focus();
      this.previousFocus = null;
    }
  }

  /**
   * 聚焦到第一个可聚焦元素
   */
  focusFirst(container: HTMLElement): void {
    const focusable = this.getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }

  /**
   * 聚焦到最后一个可聚焦元素
   */
  focusLast(container: HTMLElement): void {
    const focusable = this.getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
    }
  }

  /**
   * 取得所有可聚焦元素
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      'details',
      '[contenteditable]',
    ].join(', ');

    return Array.from(container.querySelectorAll(selector));
  }

  /**
   * 陷阱焦点在容器内（用于模态框）
   */
  trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusable = this.getFocusableElements(container);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}

/**
 * 屏幕阅读器通知
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // 移除元素
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * 顏色對比度檢查工具
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function getLuminance(color: string): number {
  const rgb = parseColor(color);
  const [r, g, b] = rgb.map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColor(color: string): number[] {
  const match = color.match(/#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i);
  if (match) {
    return match.slice(1).map(hex => parseInt(hex, 16));
  }
  return [0, 0, 0];
}

/**
 * 檢查是否符合 WCAG AA 標準（正常文字 4.5:1，大文字 3:1）
 */
export function meetsWCAGAA(color1: string, color2: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(color1, color2);
  const threshold = isLargeText ? 3.0 : 4.5;
  return ratio >= threshold;
}

/**
 * 无障碍钩子
 */
export function useAccessibility() {
  const focusManager = new FocusManager();

  return {
    focusManager,
    announceToScreenReader,
    createKeyboardHandler,
    createAriaProps,
    meetsWCAGAA,
  };
}

// 匯出全局焦點管理器實例
export const globalFocusManager = new FocusManager();
