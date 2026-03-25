import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('App Sidebar renders correctly', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('networkidle');
  await window.screenshot({ path: '/tmp/screenshot_sidebar.png' });
  await electronApp.close();
});
