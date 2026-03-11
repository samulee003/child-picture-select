/**
 * 安全儲存模組 - 加密敏感資料
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 從系統產生或取得加密金鑰
 */
function getEncryptionKey(): Buffer {
  const keyPath = 'find-my-kid-encryption-key';
  
  try {
    // 嘗試從環境變數或本機設定值取得
    const storedKey = process.env.FIND_MY_KID_ENCRYPTION_KEY;
    if (storedKey) {
      return Buffer.from(storedKey, 'hex');
    }
  } catch (e) {
    // 忽略错误，生成新密钥
  }

  // 生成新密钥并存储
  const newKey = crypto.randomBytes(32);
  process.env.FIND_MY_KID_ENCRYPTION_KEY = newKey.toString('hex');
  return newKey;
}

/**
 * 加密資料
 */
export function encrypt(data: string, key?: Buffer): string {
  const encryptionKey = key || getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // 组合：IV + AuthTag + EncryptedData
  return iv.toString('hex') + authTag + encrypted;
}

/**
 * 解密資料
 */
export function decrypt(encryptedData: string, key?: Buffer): string {
  const encryptionKey = key || getEncryptionKey();
  
  const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex');
  const authTag = Buffer.from(
    encryptedData.slice(IV_LENGTH * 2, IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2),
    'hex'
  );
  const encrypted = encryptedData.slice(IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2);

  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 安全儲存類別
 */
export class SecureStore {
  private cache: Map<string, any> = new Map();
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  /**
   * 設定加密儲存值
   */
  set<T>(key: string, value: T): void {
    try {
      const json = JSON.stringify(value);
      const encrypted = encrypt(json);
      this.cache.set(key, value);
      
      // 存储到文件系统（由主进程处理）
      if (process.env.STORAGE_PATH) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.env.STORAGE_PATH, `${key}.enc`);
        fs.writeFileSync(filePath, encrypted);
      }
    } catch (error) {
      console.error('SecureStore.set error:', error);
      throw error;
    }
  }

  /**
   * 取得解密後的值
   */
  get<T>(key: string): T | undefined {
    // 先檢查快取
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    try {
      // 從檔案系統載入
      if (process.env.STORAGE_PATH) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.env.STORAGE_PATH, `${key}.enc`);
        
        if (fs.existsSync(filePath)) {
          const encrypted = fs.readFileSync(filePath, 'utf8');
          const decrypted = decrypt(encrypted);
          const parsed = JSON.parse(decrypted);
          this.cache.set(key, parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error('SecureStore.get error:', error);
    }

    return undefined;
  }

  /**
   * 刪除值
   */
  delete(key: string): boolean {
    this.cache.delete(key);
    
    try {
      if (process.env.STORAGE_PATH) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.env.STORAGE_PATH, `${key}.enc`);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          return true;
        }
      }
    } catch (error) {
      console.error('SecureStore.delete error:', error);
    }

    return false;
  }

  /**
   * 清除所有資料
   */
  clear(): void {
    this.cache.clear();
    
    try {
      if (process.env.STORAGE_PATH) {
        const fs = require('fs');
        const path = require('path');
        const files = fs.readdirSync(process.env.STORAGE_PATH);
        
        files.forEach((file: string) => {
          if (file.endsWith('.enc')) {
            fs.unlinkSync(path.join(process.env.STORAGE_PATH, file));
          }
        });
      }
    } catch (error) {
      console.error('SecureStore.clear error:', error);
    }
  }

  /**
   * 匯出所有資料（用於備份）
   */
  exportAll(): Record<string, any> {
    const result: Record<string, any> = {};
    
    this.cache.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * 匯入資料（用於回復）
   */
  importAll(data: Record<string, any>): void {
    Object.entries(data).forEach(([key, value]) => {
      this.set(key, value);
    });
  }
}

// 建立全域實例
let secureStoreInstance: SecureStore | null = null;

export function getSecureStore(): SecureStore {
  if (!secureStoreInstance) {
    secureStoreInstance = new SecureStore(process.env.STORAGE_PATH || '');
  }
  return secureStoreInstance;
}
