import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScanState } from '../../../src/renderer/hooks/useScanState';

describe('useScanState', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as any).api = {
      getAppInfo: vi.fn().mockResolvedValue({ appName: '大海撈Ｂ', version: '0.2.1' }),
      getModelStatus: vi.fn().mockResolvedValue({ loaded: true, error: null }),
      setPerformanceMode: vi.fn().mockResolvedValue({ ok: true }),
      onScanProgress: vi.fn(),
      removeScanProgressListener: vi.fn(),
      selectFiles: vi.fn().mockResolvedValue([]),
    };
  });

  it('does not auto-restore folder/ref paths from localStorage on startup', async () => {
    localStorage.setItem('app-settings', JSON.stringify({
      threshold: 0.72,
      topN: 25,
      lastReferencePaths: ['C:/a.jpg', 'C:/b.jpg'],
      lastFolder: 'C:/photos',
    }));

    const { result } = renderHook(() => useScanState());

    await waitFor(() => {
      expect((window as any).api.getModelStatus).toHaveBeenCalled();
    });

    expect(result.current.refPaths).toBe('');
    expect(result.current.folder).toBe('');
  });

  it('replaces ref list (not append) when browsing files', async () => {
    const api = (window as any).api;
    api.selectFiles.mockResolvedValue(['C:/new1.jpg', 'C:/new2.jpg']);
    const { result } = renderHook(() => useScanState());

    act(() => {
      result.current.setRefPaths('C:/old1.jpg\nC:/old2.jpg');
      result.current.setRefsLoaded(10);
      result.current.setStatus('refs ready');
    });

    await act(async () => {
      await result.current.handleBrowseFiles();
    });

    expect(result.current.refPaths).toBe('C:/new1.jpg\nC:/new2.jpg');
    expect(result.current.refsLoaded).toBe(0);
    expect(result.current.status).toBe('idle');
  });

  it('resets loaded refs when dropping new reference files', async () => {
    const { result } = renderHook(() => useScanState());

    await waitFor(() => {
      expect((window as any).api.getModelStatus).toHaveBeenCalled();
    });

    act(() => {
      result.current.setRefPaths('C:/old1.jpg');
      result.current.setRefsLoaded(3);
      result.current.setStatus('refs ready');
      result.current.setError('✅ 3 張照片成功偵測到人臉');
    });

    act(() => {
      result.current.handleRefFilesDrop(['C:/new1.jpg', 'C:/new2.jpg']);
    });

    expect(result.current.refPaths).toContain('C:/new1.jpg');
    expect(result.current.refPaths).toContain('C:/new2.jpg');
    expect(result.current.refsLoaded).toBe(0);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
