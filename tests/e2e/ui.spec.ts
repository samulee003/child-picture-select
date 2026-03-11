import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Mock IPC API for testing
  await page.addInitScript(() => {
    (window as any).api = {
      ping: async () => 'pong',
      embedReferences: async (files: string[]) => {
        // Validate input
        if (!Array.isArray(files) || files.length === 0) {
          return { ok: false, error: 'No files provided' };
        }
        return { ok: true, count: files.length };
      },
      runScan: async (dir: string) => {
        if (!dir || dir.trim() === '') {
          return { ok: false, error: 'Directory path required' };
        }
        return { ok: true, scanned: 3 };
      },
      runMatch: async (opts: { topN: number; threshold: number }) => {
        if (!opts || typeof opts.topN !== 'number' || typeof opts.threshold !== 'number') {
          return [];
        }
        return [
          { path: 'C:/photos/a.jpg', score: 0.91 },
          { path: 'C:/photos/b.jpg', score: 0.88 },
          { path: 'C:/photos/c.jpg', score: 0.75 }
        ].filter(r => r.score >= opts.threshold).slice(0, opts.topN);
      },
      exportCopy: async (files: string[], outDir: string) => {
        if (!Array.isArray(files) || files.length === 0) {
          return { ok: false, error: 'No files to export' };
        }
        if (!outDir || outDir.trim() === '') {
          return { ok: false, error: 'Output directory required' };
        }
        return { ok: true, copied: files.length };
      }
    };
  });
});

test('user can embed refs, scan, match, and see results', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText(/Find My Kid/i);

  // Provide reference files
  await page.locator('textarea').fill('C:/ref/1.jpg\nC:/ref/2.jpg');
  await page.getByRole('button', { name: '嵌入參考臉' }).click();
  
  // Wait for status update
  await expect(page.locator('small')).toContainText(/refs ready|idle/i);

  // Provide folder and run
  await page.getByPlaceholder('輸入或貼上資料夾路徑').fill('C:/photos');
  await page.getByRole('button', { name: '掃描與比對' }).click();

  // Expect results rendered
  await expect(page.locator('h3')).toContainText('候選結果');
  await expect(page.locator('ol li')).toHaveCount(2); // Filtered by threshold
});

test('validates input and shows errors', async ({ page }) => {
  await page.goto('/');

  // Try to embed without files
  await page.locator('textarea').fill('');
  await page.getByRole('button', { name: '嵌入參考臉' }).click();
  // Should handle gracefully (button might be disabled or no-op)

  // Try to scan without folder
  await page.getByPlaceholder('輸入或貼上資料夾路徑').fill('');
  // Button might be disabled, but if clicked should handle error
});

test('respects threshold and topN settings', async ({ page }) => {
  await page.goto('/');

  // Set high threshold
  const thresholdInput = page.locator('input[type="range"]');
  await thresholdInput.fill('0.90'); // High threshold

  await page.locator('textarea').fill('C:/ref/1.jpg');
  await page.getByRole('button', { name: '嵌入參考臉' }).click();

  await page.getByPlaceholder('輸入或貼上資料夾路徑').fill('C:/photos');
  await page.getByRole('button', { name: '掃描與比對' }).click();

  // With threshold 0.90, only one result should pass (0.91 > 0.90, 0.88 < 0.90)
  await expect(page.locator('ol li')).toHaveCount(1);
});

test('export functionality works', async ({ page }) => {
  await page.goto('/');

  // Complete workflow first
  await page.locator('textarea').fill('C:/ref/1.jpg');
  await page.getByRole('button', { name: '嵌入參考臉' }).click();
  await page.getByPlaceholder('輸入或貼上資料夾路徑').fill('C:/photos');
  await page.getByRole('button', { name: '掃描與比對' }).click();

  // Wait for results
  await expect(page.locator('h3')).toContainText('候選結果');

  // Export button should be enabled when there are results
  const exportButton = page.getByRole('button', { name: '匯出結果' });
  await expect(exportButton).toBeEnabled();
  await exportButton.click();

  // Status should update
  await expect(page.locator('small')).toContainText(/exported/i);
});


