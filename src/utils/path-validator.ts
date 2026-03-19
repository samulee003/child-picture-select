import { normalize, isAbsolute, extname, sep } from 'path';
import { existsSync, statSync } from 'fs';

const MAX_PATH_LENGTH = 4096;

export interface PathValidationResult {
  valid: boolean;
  normalizedPath?: string;
  error?: string;
}

/**
 * 驗證路徑是否包含目錄遍歷攻擊嘗試
 */
function containsPathTraversal(inputPath: string): boolean {
  const normalized = normalize(inputPath);
  // 檢查是否包含 .. 目錄遍歷
  const parts = normalized.split(sep);
  return parts.some(part => part === '..');
}

/**
 * 驗證路徑是否包含非法字符
 * 注意：Windows 路徑中的驅動器號冒號是合法的（如 C:）
 */
function containsIllegalChars(inputPath: string): boolean {
  // Windows 禁止的字符（除了冒號，因為它在驅動器號中是合法的）
  const illegalChars = /[<>"|?*]/;

  // 檢查路徑各部分（除了驅動器號）
  const parts = inputPath.split(/[\\/]/);
  for (const part of parts) {
    // Windows 保留名（CON, PRN 等）
    const reservedName = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reservedName.test(part)) {
      return true;
    }

    // 檢查非法字符（排除空字符串和驅動器號）
    if (part && !part.includes(':') && illegalChars.test(part)) {
      return true;
    }
  }

  return false;
}

export function validatePath(
  inputPath: string,
  options: {
    mustExist?: boolean;
    mustBeFile?: boolean;
    mustBeDirectory?: boolean;
    allowedExtensions?: string[];
    allowAbsolute?: boolean;
  } = {}
): PathValidationResult {
  if (!inputPath || typeof inputPath !== 'string') {
    return { valid: false, error: '路徑不能為空' };
  }

  if (inputPath.length > MAX_PATH_LENGTH) {
    return { valid: false, error: '路徑長度超過限制' };
  }

  // 檢查控制字符
  if (/[\x00-\x1f\x7f]/.test(inputPath)) {
    return { valid: false, error: '路徑包含控制字符' };
  }

  // 檢查目錄遍歷
  if (containsPathTraversal(inputPath)) {
    return { valid: false, error: '路徑包含不允許的目錄遍歷' };
  }

  // 檢查非法字符
  if (containsIllegalChars(inputPath)) {
    return { valid: false, error: '路徑包含非法字符' };
  }

  // 標準化路徑
  let normalizedPath: string;
  try {
    normalizedPath = normalize(inputPath);
  } catch {
    return { valid: false, error: '路徑格式無效' };
  }

  // 檢查絕對路徑
  if (options.allowAbsolute === false && isAbsolute(normalizedPath)) {
    return { valid: false, error: '不允許使用絕對路徑' };
  }

  // 檢查文件是否存在
  if (options.mustExist && !existsSync(normalizedPath)) {
    return { valid: false, error: '指定的路徑不存在' };
  }

  // 檢查是文件還是目錄
  if (options.mustExist) {
    try {
      const stats = statSync(normalizedPath);
      if (options.mustBeFile && !stats.isFile()) {
        return { valid: false, error: '指定的路徑不是文件' };
      }
      if (options.mustBeDirectory && !stats.isDirectory()) {
        return { valid: false, error: '指定的路徑不是目錄' };
      }
    } catch {
      return { valid: false, error: '無法訪問指定的路徑' };
    }
  }

  // 檢查擴展名
  if (options.allowedExtensions && options.allowedExtensions.length > 0) {
    const ext = extname(normalizedPath).toLowerCase();
    if (!options.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `不支持的文件類型，允許的擴展名: ${options.allowedExtensions.join(', ')}`,
      };
    }
  }

  return { valid: true, normalizedPath };
}

export function sanitizePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') return '';

  // 移除危險字符（保留冒號用於 Windows 驅動器號）
  let sanitized = inputPath.replace(/[<>"|?*]/g, '_').replace(/[\x00-\x1f\x7f]/g, '');

  // 標準化
  try {
    sanitized = normalize(sanitized);
  } catch {
    return '';
  }

  return sanitized;
}

export function isValidImagePath(path: string): boolean {
  // 檢查路徑是否存在且為文件（不限制擴展名大小寫）
  const basicResult = validatePath(path, {
    mustExist: true,
    mustBeFile: true,
  });

  if (!basicResult.valid) {
    return false;
  }

  // 手動檢查擴展名（不區分大小寫）
  const ext = extname(path).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif'];
  return allowedExtensions.includes(ext);
}

export function isValidFolderPath(path: string): boolean {
  const result = validatePath(path, {
    mustExist: true,
    mustBeDirectory: true,
  });
  return result.valid;
}
