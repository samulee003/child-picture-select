/**
 * 強化的錯誤處理工具
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface AppError extends Error {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  context?: ErrorContext;
  originalError?: any;
}

/**
 * 錯誤代碼列舉
 */
export enum ErrorCode {
  // 通用錯誤
  UNKNOWN = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  
  // 檔案相關
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  FILE_CORRUPTED = 'FILE_CORRUPTED',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  
  // 照片處理
  PHOTO_LOAD_FAILED = 'PHOTO_LOAD_FAILED',
  FACE_DETECTION_FAILED = 'FACE_DETECTION_FAILED',
  EMBEDDING_GENERATION_FAILED = 'EMBEDDING_GENERATION_FAILED',
  THUMBNAIL_GENERATION_FAILED = 'THUMBNAIL_GENERATION_FAILED',
  
  // 資料庫
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_LOCKED = 'DATABASE_LOCKED',
  DATABASE_CORRUPTED = 'DATABASE_CORRUPTED',
  
  // 記憶體與效能
  LOW_MEMORY = 'LOW_MEMORY',
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  
  // 使用者操作
  INVALID_INPUT = 'INVALID_INPUT',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/**
 * 建立應用程式錯誤
 */
export function createAppError(
  message: string,
  code: ErrorCode = ErrorCode.UNKNOWN,
  severity: AppError['severity'] = 'medium',
  originalError?: any,
  context?: ErrorContext
): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.severity = severity;
  error.recoverable = severity !== 'critical';
  error.originalError = originalError;
  error.context = {
    ...context,
    timestamp: context?.timestamp || new Date().toISOString(),
  };
  return error;
}

/**
 * 錯誤分類
 */
export function categorizeError(error: any): {
  code: ErrorCode;
  userMessage: string;
  suggestedAction: string;
} {
  // 已標記的應用錯誤
  if (error.code && Object.values(ErrorCode).includes(error.code)) {
    return getErrorInfo(error.code as ErrorCode, error.message);
  }

  // Node.js 系統錯誤
  if (error.code === 'ENOENT') {
    return {
      code: ErrorCode.FILE_NOT_FOUND,
      userMessage: '檔案未找到',
      suggestedAction: '請確認檔案路徑正確',
    };
  }

  if (error.code === 'EACCES') {
    return {
      code: ErrorCode.FILE_ACCESS_DENIED,
      userMessage: '無法存取檔案',
      suggestedAction: '請檢查檔案權限',
    };
  }

  // 記憶體相關
  if (error.message?.includes('memory') || error.message?.includes('heap')) {
    return {
      code: ErrorCode.LOW_MEMORY,
      userMessage: '記憶體不足',
      suggestedAction: '請關閉其他程式或減少處理數量',
    };
  }

  // 逾時
  if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
    return {
      code: ErrorCode.TIMEOUT,
      userMessage: '操作逾時',
      suggestedAction: '請重試或減少處理數量',
    };
  }

  // 預設未知錯誤
  return {
    code: ErrorCode.UNKNOWN,
    userMessage: error.message || '发生未知错误',
    suggestedAction: '請重試或聯絡技術支援',
  };
}

/**
 * 取得錯誤詳細資訊
 */
function getErrorInfo(code: ErrorCode, defaultMessage: string): {
  code: ErrorCode;
  userMessage: string;
  suggestedAction: string;
} {
  const errorMap: Record<ErrorCode, { message: string; action: string }> = {
    [ErrorCode.UNKNOWN]: {
      message: defaultMessage,
      action: '請重試或聯絡技術支援',
    },
    [ErrorCode.NETWORK_ERROR]: {
      message: '網路錯誤',
      action: '請檢查網路連線',
    },
    [ErrorCode.TIMEOUT]: {
      message: '操作逾時',
      action: '請重試或減少處理數量',
    },
    [ErrorCode.FILE_NOT_FOUND]: {
      message: '檔案未找到',
      action: '請確認檔案路徑正確',
    },
    [ErrorCode.FILE_ACCESS_DENIED]: {
      message: '無法存取檔案',
      action: '請檢查檔案權限',
    },
    [ErrorCode.FILE_CORRUPTED]: {
      message: '檔案已損壞',
      action: '請選擇其他檔案',
    },
    [ErrorCode.UNSUPPORTED_FORMAT]: {
      message: '不支援的檔案格式',
      action: '請使用 JPG、PNG 或 HEIC 格式',
    },
    [ErrorCode.PHOTO_LOAD_FAILED]: {
      message: '照片載入失敗',
      action: '請確認照片完整且未損壞',
    },
    [ErrorCode.FACE_DETECTION_FAILED]: {
      message: '人臉偵測失敗',
      action: '請使用面部清晰的照片',
    },
    [ErrorCode.EMBEDDING_GENERATION_FAILED]: {
      message: '特徵提取失敗',
      action: '請重試或更換照片',
    },
    [ErrorCode.THUMBNAIL_GENERATION_FAILED]: {
      message: '縮圖生成失敗',
      action: '不影響主要功能，可繼續使用',
    },
    [ErrorCode.DATABASE_ERROR]: {
      message: '資料庫錯誤',
      action: '請重啟應用',
    },
    [ErrorCode.DATABASE_LOCKED]: {
      message: '資料庫被鎖定',
      action: '請稍後重試',
    },
    [ErrorCode.DATABASE_CORRUPTED]: {
      message: '資料庫損壞',
      action: '請聯絡技術支援',
    },
    [ErrorCode.LOW_MEMORY]: {
      message: '記憶體不足',
      action: '請關閉其他程式或減少處理數量',
    },
    [ErrorCode.PROCESSING_TIMEOUT]: {
      message: '處理逾時',
      action: '請重試或減少處理數量',
    },
    [ErrorCode.MAX_RETRIES_EXCEEDED]: {
      message: '重試次數過多',
      action: '請稍後重試',
    },
    [ErrorCode.INVALID_INPUT]: {
      message: '輸入無效',
      action: '請檢查輸入內容',
    },
    [ErrorCode.OPERATION_CANCELLED]: {
      message: '操作已取消',
      action: '',
    },
    [ErrorCode.PERMISSION_DENIED]: {
      message: '權限不足',
      action: '請授予必要權限',
    },
  };

  const info = errorMap[code] || errorMap[ErrorCode.UNKNOWN];
  return {
    code,
    userMessage: info.message,
    suggestedAction: info.action,
  };
}

/**
 * 錯誤恢復策略
 */
export interface RecoveryStrategy {
  canRecover: boolean;
  retryCount?: number;
  retryDelay?: number;
  fallbackAction?: () => any;
}

/**
 * 取得錯誤恢復策略
 */
export function getRecoveryStrategy(error: AppError): RecoveryStrategy {
  switch (error.code) {
    case ErrorCode.TIMEOUT:
    case ErrorCode.PROCESSING_TIMEOUT:
      return {
        canRecover: true,
        retryCount: 3,
        retryDelay: 1000,
      };

    case ErrorCode.LOW_MEMORY:
      return {
        canRecover: true,
        retryCount: 1,
        retryDelay: 2000,
        fallbackAction: () => {
          // 触发垃圾回收（如果可用）
          if (global.gc) {
            global.gc();
          }
        },
      };

    case ErrorCode.DATABASE_LOCKED:
      return {
        canRecover: true,
        retryCount: 5,
        retryDelay: 500,
      };

    case ErrorCode.NETWORK_ERROR:
      return {
        canRecover: true,
        retryCount: 3,
        retryDelay: 2000,
      };

    case ErrorCode.FILE_NOT_FOUND:
    case ErrorCode.PERMISSION_DENIED:
    case ErrorCode.DATABASE_CORRUPTED:
      return {
        canRecover: false,
      };

    default:
      return {
        canRecover: error.recoverable,
        retryCount: error.recoverable ? 1 : 0,
      };
  }
}

/**
 * 錯誤日誌記錄
 */
export function logError(
  error: AppError | Error,
  context: ErrorContext = {}
): void {
  const timestamp = new Date().toISOString();
  const errorInfo = error instanceof Error && 'code' in error
    ? error as AppError
    : categorizeError(error);

  const logEntry = {
    timestamp,
    level: error instanceof Error && 'severity' in error && error.severity ? error.severity : 'medium',
    code: 'code' in error ? error.code : errorInfo.code,
    message: error.message,
    stack: error.stack,
    context,
  };

  // 開發模式輸出到控制台
  if (process.env.NODE_ENV === 'development') {
    console.error('[App Error]', logEntry);
  }

  // 生產模式記錄到日誌檔案（由主程序處理）
  // 這裡只記錄關鍵錯誤
  if (logEntry.level === 'critical' || logEntry.level === 'high') {
    // 傳送到錯誤回報服務（可選）
  }
}

/**
 * 安全執行函式，擷取並封裝錯誤
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: ErrorContext = {}
): Promise<{ success: true; data: T } | { success: false; error: AppError }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err: any) {
    const { code, userMessage } = categorizeError(err);
    const message =
      code === ErrorCode.UNKNOWN
        ? `发生未知错误：${userMessage}`
        : userMessage;
    const appError = createAppError(
      message,
      code,
      'medium',
      err,
      context
    );
    logError(appError, context);
    return { success: false, error: appError };
  }
}

/**
 * 使用者友善的錯誤訊息
 */
export function getUserFriendlyMessage(error: any): string {
  const { userMessage, suggestedAction } = categorizeError(error);
  
  if (suggestedAction) {
    return `${userMessage}。${suggestedAction}`;
  }
  
  return userMessage;
}
