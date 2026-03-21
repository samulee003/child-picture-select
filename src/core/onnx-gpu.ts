/**
 * ONNX Runtime GPU 加速偵測與 session 建立工具
 *
 * 自動偵測可用的 GPU 執行提供者（DirectML / CUDA / CoreML），
 * 若 GPU 不可用則自動回退到 CPU。
 */

import { logger } from '../utils/logger';

/** 目前使用的執行提供者（初始化後設定） */
let activeProvider: string = 'cpu';

/** 取得目前使用的執行提供者名稱 */
export function getActiveProvider(): string {
  return activeProvider;
}

/**
 * 根據平台決定嘗試的執行提供者順序
 * Windows: DirectML → CPU
 * Linux (NVIDIA): CUDA → CPU
 * macOS: CoreML → CPU
 */
function getPreferredProviders(): string[] {
  const platform = process.platform;
  if (platform === 'win32') {
    return ['dml', 'cpu'];
  }
  if (platform === 'linux') {
    return ['cuda', 'cpu'];
  }
  if (platform === 'darwin') {
    return ['coreml', 'cpu'];
  }
  return ['cpu'];
}

/**
 * 建立 ONNX InferenceSession，自動嘗試 GPU 加速
 * 如果 GPU 提供者不可用，會自動回退到 CPU
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createSessionWithGpu(ort: any, modelPath: string, modelName: string): Promise<any> {
  const providers = getPreferredProviders();

  // 先嘗試包含 GPU 的提供者清單
  if (providers[0] !== 'cpu') {
    try {
      logger.info(`🚀 ${modelName}: 嘗試 GPU 加速 (${providers[0]})...`);
      const session = await ort.InferenceSession.create(modelPath, {
        executionProviders: providers,
        logSeverityLevel: 3,
      });
      activeProvider = providers[0];
      logger.info(`✅ ${modelName}: 使用 ${providers[0].toUpperCase()} GPU 加速`);
      return session;
    } catch (gpuErr: unknown) {
      const msg = gpuErr instanceof Error ? gpuErr.message : String(gpuErr);
      logger.warn(`⚠️ ${modelName}: GPU (${providers[0]}) 不可用，回退到 CPU。原因: ${msg}`);
    }
  }

  // 回退到 CPU
  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    logSeverityLevel: 3,
  });
  activeProvider = 'cpu';
  logger.info(`${modelName}: 使用 CPU 執行`);
  return session;
}
