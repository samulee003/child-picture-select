// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  createAriaProps,
  getContrastRatio,
  meetsWCAGAA,
  FocusManager,
  announceToScreenReader,
  createKeyboardHandler,
  useAccessibility
} from '../../../src/utils/accessibility';

describe('Accessibility Utilities', () => {
  describe('createAriaProps', () => {
    it('should return empty object when no arguments are provided', () => {
      expect(createAriaProps()).toEqual({});
    });

    it('should return object with aria-label', () => {
      expect(createAriaProps('test label')).toEqual({ 'aria-label': 'test label' });
    });

    it('should return object with aria-describedby', () => {
      expect(createAriaProps(undefined, 'desc-id')).toEqual({ 'aria-describedby': 'desc-id' });
    });

    it('should return object with aria-live', () => {
      expect(createAriaProps(undefined, undefined, 'polite')).toEqual({ 'aria-live': 'polite' });
    });

    it('should return object with all props', () => {
      expect(createAriaProps('label', 'desc', 'assertive')).toEqual({
        'aria-label': 'label',
        'aria-describedby': 'desc',
        'aria-live': 'assertive'
      });
    });
  });

  describe('Contrast Utilities', () => {
    it('getContrastRatio should calculate correct ratio for black and white', () => {
      const ratio = getContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('getContrastRatio should calculate correct ratio for same colors', () => {
      const ratio = getContrastRatio('#FFFFFF', '#FFFFFF');
      expect(ratio).toBeCloseTo(1, 0);
    });

    it('meetsWCAGAA should validate contrast correctly', () => {
      // White on black: ~21:1
      expect(meetsWCAGAA('#FFFFFF', '#000000')).toBe(true);
      // Gray (#767676) on white: ~4.54:1 (Passes AA for normal text)
      expect(meetsWCAGAA('#767676', '#FFFFFF')).toBe(true);
      // Light gray (#AAAAAA) on white: ~2.32:1 (Fails AA for normal text)
      expect(meetsWCAGAA('#AAAAAA', '#FFFFFF')).toBe(false);

      // #959595 on white is ~2.99:1
      // Fails even for large text (3:1)
      expect(meetsWCAGAA('#959595', '#FFFFFF', true)).toBe(false);
      expect(meetsWCAGAA('#959595', '#FFFFFF', false)).toBe(false);

      // #888888 on white is ~3.5:1
      expect(meetsWCAGAA('#888888', '#FFFFFF', true)).toBe(true);
      expect(meetsWCAGAA('#888888', '#FFFFFF', false)).toBe(false);
    });
  });

  describe('createKeyboardHandler', () => {
    it('should trigger correct callbacks for keys', () => {
      const config = {
        onEnter: vi.fn(),
        onSpace: vi.fn(),
        onEscape: vi.fn(),
        onArrowUp: vi.fn(),
        onArrowDown: vi.fn(),
        onArrowLeft: vi.fn(),
        onArrowRight: vi.fn(),
        onTab: vi.fn(),
        onShiftTab: vi.fn(),
      };

      const handler = createKeyboardHandler(config);

      const createEvent = (key: string, shiftKey = false) => ({
        key,
        shiftKey,
        preventDefault: vi.fn(),
      } as any);

      handler(createEvent('Enter'));
      expect(config.onEnter).toHaveBeenCalled();

      const spaceEvent = createEvent(' ');
      handler(spaceEvent);
      expect(spaceEvent.preventDefault).toHaveBeenCalled();
      expect(config.onSpace).toHaveBeenCalled();

      handler(createEvent('Escape'));
      expect(config.onEscape).toHaveBeenCalled();

      const upEvent = createEvent('ArrowUp');
      handler(upEvent);
      expect(upEvent.preventDefault).toHaveBeenCalled();
      expect(config.onArrowUp).toHaveBeenCalled();

      handler(createEvent('Tab'));
      expect(config.onTab).toHaveBeenCalled();

      handler(createEvent('Tab', true));
      expect(config.onShiftTab).toHaveBeenCalled();
    });
  });

  describe('FocusManager', () => {
    let manager: FocusManager;
    let container: HTMLDivElement;
    let btn1: HTMLButtonElement;
    let btn2: HTMLButtonElement;
    let input: HTMLInputElement;

    beforeEach(() => {
      manager = new FocusManager();
      container = document.createElement('div');
      btn1 = document.createElement('button');
      btn2 = document.createElement('button');
      input = document.createElement('input');

      container.appendChild(btn1);
      container.appendChild(btn2);
      container.appendChild(input);
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('focus and restore should work', () => {
      const otherBtn = document.createElement('button');
      document.body.appendChild(otherBtn);
      otherBtn.focus();
      const initialActive = document.activeElement;

      manager.focus(btn1);
      expect(document.activeElement).toBe(btn1);

      manager.restore();
      expect(document.activeElement).toBe(initialActive);

      document.body.removeChild(otherBtn);
    });

    it('focusFirst and focusLast should work', () => {
      manager.focusFirst(container);
      expect(document.activeElement).toBe(btn1);

      manager.focusLast(container);
      expect(document.activeElement).toBe(input);
    });

    it('getFocusableElements should return correct elements', () => {
      const elements = manager.getFocusableElements(container);
      expect(elements).toHaveLength(3);
      expect(elements).toContain(btn1);
      expect(elements).toContain(btn2);
      expect(elements).toContain(input);
    });

    it('trapFocus should wrap around from last to first', () => {
      input.focus();
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      manager.trapFocus(container, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(btn1);
    });

    it('trapFocus should wrap around from first to last with shift', () => {
      btn1.focus();
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      manager.trapFocus(container, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(input);
    });
  });

  describe('announceToScreenReader', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      // Cleanup any left over announcements
      document.querySelectorAll('[role="status"]').forEach(el => el.remove());
    });

    it('should create an announcement element and remove it after 1000ms', () => {
      announceToScreenReader('Test announcement');

      const announcement = document.querySelector('[role="status"]');
      expect(announcement).toBeTruthy();
      expect(announcement?.textContent).toBe('Test announcement');
      expect(announcement?.getAttribute('aria-live')).toBe('polite');

      vi.advanceTimersByTime(1000);
      expect(document.querySelector('[role="status"]')).toBeFalsy();
    });

    it('should support assertive priority', () => {
      announceToScreenReader('Urgent message', 'assertive');

      const announcement = document.querySelector('[role="status"]');
      expect(announcement?.getAttribute('aria-live')).toBe('assertive');
    });
  });

  describe('useAccessibility', () => {
    it('should return the expected utilities', () => {
      const { result } = renderHook(() => useAccessibility());
      const utils = result.current;
      expect(utils).toHaveProperty('focusManager');
      expect(utils).toHaveProperty('announceToScreenReader');
      expect(utils).toHaveProperty('createKeyboardHandler');
      expect(utils).toHaveProperty('createAriaProps');
      expect(utils).toHaveProperty('meetsWCAGAA');
      expect(utils.focusManager).toBeInstanceOf(FocusManager);
    });
  });
});
