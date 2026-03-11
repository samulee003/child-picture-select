import { useEffect, useCallback } from 'react';

type KeyboardShortcut = {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
};

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey;
      const shiftMatches = !!shortcut.shiftKey === event.shiftKey;
      const altMatches = !!shortcut.altKey === event.altKey;

      if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
        break;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

export const commonShortcuts = {
  save: { key: 's', ctrlKey: true, description: '儲存設定' },
  run: { key: 'Enter', ctrlKey: true, description: '開始搜尋' },
  export: { key: 'e', ctrlKey: true, description: '匯出結果' },
  clear: { key: 'Delete', ctrlKey: true, description: '清除結果' },
  help: { key: 'F1', description: '顯示說明' }
};