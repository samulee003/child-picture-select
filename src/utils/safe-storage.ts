/**
 * Safe wrapper around localStorage to handle QuotaExceededError
 * and other storage failures gracefully.
 */

export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`localStorage.setItem failed for key "${key}":`, err);
    return false;
  }
}

export function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`localStorage.getItem failed for key "${key}":`, err);
    return null;
  }
}
