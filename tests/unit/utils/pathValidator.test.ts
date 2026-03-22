/**
 * Unit tests for src/utils/path-validator.ts
 *
 * validatePath, sanitizePath, isValidImagePath（無需 Electron/DB）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validatePath, sanitizePath, isValidImagePath } from '../../../src/utils/path-validator';

// ── Setup ─────────────────────────────────────────────────────────────────────

let tmpDir: string;
let testFile: string;
let testDir: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathval-test-'));
  testFile = path.join(tmpDir, 'sample.jpg');
  testDir = path.join(tmpDir, 'subdir');
  fs.writeFileSync(testFile, 'JFIF');
  fs.mkdirSync(testDir);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── validatePath ──────────────────────────────────────────────────────────────

describe('validatePath – basic validation', () => {
  it('returns invalid for empty string', () => {
    expect(validatePath('').valid).toBe(false);
  });

  it('returns invalid for non-string input', () => {
    // @ts-expect-error intentional bad input
    expect(validatePath(null).valid).toBe(false);
    // @ts-expect-error intentional bad input
    expect(validatePath(undefined).valid).toBe(false);
  });

  it('returns invalid for paths exceeding 4096 chars', () => {
    const longPath = '/tmp/' + 'a'.repeat(4100);
    expect(validatePath(longPath).valid).toBe(false);
  });

  it('returns invalid for paths with null bytes', () => {
    expect(validatePath('/tmp/foo\x00bar').valid).toBe(false);
  });

  it('returns invalid for paths with control characters', () => {
    expect(validatePath('/tmp/foo\x01bar').valid).toBe(false);
  });
});

describe('validatePath – path traversal detection', () => {
  // containsPathTraversal checks for '..' AFTER path.normalize().
  // Absolute paths: normalize resolves all '..' so '/safe/../../../etc/passwd' → '/etc/passwd' (no '..' remains).
  // Relative paths: normalize KEEPS leading '..' because they cannot be resolved without a base.
  // Therefore the guard catches relative traversal attempts like '../../etc/passwd'.

  it('rejects relative traversal path (../../)', () => {
    const result = validatePath('../../etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('遍歷');
  });

  it('rejects Windows relative traversal (..\\..\\ style)', () => {
    const result = validatePath('..\\..\\Windows\\system32');
    expect(result.valid).toBe(false);
  });

  it('accepts a normal absolute path (no traversal)', () => {
    const result = validatePath('/usr/local/photos/kid.jpg');
    expect(result.valid).toBe(true);
  });

  it('accepts an absolute path whose components include ".." — they are resolved by normalize', () => {
    // After normalize('/safe/path/../photos') → '/safe/photos' — no '..' remains
    const result = validatePath('/safe/path/../photos/kid.jpg');
    expect(result.valid).toBe(true);
  });
});

describe('validatePath – illegal characters', () => {
  it('rejects paths with < or >', () => {
    expect(validatePath('/tmp/<bad>').valid).toBe(false);
    expect(validatePath('/tmp/foo>bar').valid).toBe(false);
  });

  it('rejects Windows reserved names', () => {
    expect(validatePath('/tmp/CON').valid).toBe(false);
    expect(validatePath('/tmp/NUL').valid).toBe(false);
    expect(validatePath('/tmp/COM1').valid).toBe(false);
  });

  it('accepts a normal filename with spaces', () => {
    expect(validatePath('/tmp/my photo.jpg').valid).toBe(true);
  });
});

describe('validatePath – mustExist option', () => {
  it('rejects non-existent path when mustExist=true', () => {
    const result = validatePath('/no/such/file.jpg', { mustExist: true });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('不存在');
  });

  it('accepts an existing file with mustExist=true', () => {
    const result = validatePath(testFile, { mustExist: true });
    expect(result.valid).toBe(true);
  });

  it('rejects a directory when mustBeFile=true', () => {
    const result = validatePath(testDir, { mustExist: true, mustBeFile: true });
    expect(result.valid).toBe(false);
  });

  it('rejects a file when mustBeDirectory=true', () => {
    const result = validatePath(testFile, { mustExist: true, mustBeDirectory: true });
    expect(result.valid).toBe(false);
  });

  it('accepts a directory when mustBeDirectory=true', () => {
    const result = validatePath(testDir, { mustExist: true, mustBeDirectory: true });
    expect(result.valid).toBe(true);
  });
});

describe('validatePath – extension allowlist', () => {
  it('rejects disallowed extension', () => {
    const result = validatePath('/tmp/photo.exe', { allowedExtensions: ['.jpg', '.png'] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('不支持');
  });

  it('accepts allowed extension', () => {
    const result = validatePath('/tmp/photo.jpg', { allowedExtensions: ['.jpg', '.png'] });
    expect(result.valid).toBe(true);
  });
});

describe('validatePath – returns normalizedPath', () => {
  it('includes normalizedPath in a valid result', () => {
    const result = validatePath('/tmp/photo.jpg');
    expect(result.valid).toBe(true);
    expect(typeof result.normalizedPath).toBe('string');
  });
});

// ── sanitizePath ──────────────────────────────────────────────────────────────

describe('sanitizePath', () => {
  it('removes illegal characters', () => {
    const result = sanitizePath('/tmp/<bad|file>.jpg');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('|');
  });

  it('removes control characters', () => {
    const result = sanitizePath('/tmp/foo\x00bar');
    expect(result).not.toContain('\x00');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizePath('')).toBe('');
  });

  it('returns empty string for non-string input', () => {
    // @ts-expect-error intentional bad input
    expect(sanitizePath(null)).toBe('');
  });

  it('preserves valid path intact', () => {
    const p = '/tmp/photos/kid.jpg';
    expect(sanitizePath(p)).toBe(path.normalize(p));
  });
});

// ── isValidImagePath ──────────────────────────────────────────────────────────

describe('isValidImagePath', () => {
  it('returns true for an existing JPEG file', () => {
    expect(isValidImagePath(testFile)).toBe(true);
  });

  it('returns false for a non-existent path', () => {
    expect(isValidImagePath('/no/such/image.jpg')).toBe(false);
  });

  it('returns false for an existing directory', () => {
    expect(isValidImagePath(testDir)).toBe(false);
  });

  it('returns false for an existing file with unsupported extension', () => {
    const txtFile = path.join(tmpDir, 'data.txt');
    fs.writeFileSync(txtFile, 'hello');
    expect(isValidImagePath(txtFile)).toBe(false);
  });
});
