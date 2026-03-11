/**
 * 臉部偵測模組
 * 使用 @vladmandic/human 進行臉部偵測與特徵提取
 */

import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';

export interface FaceDetection {
  bbox: [number, number, number, number]; // x, y, width, height
  embedding: number[]; // 512 維特徵向量
  confidence: number;
  age?: number;
  gender?: 'male' | 'female';
}

export interface DetectorOptions {
  /** 是否啟用年齡和性別識別 */
  enableAgeGender?: boolean;
  /** 最小臉部偵測信心度 (0-1) */
  minConfidence?: number;
}

let humanInstance: any = null;

/**
 * 初始化 Human 實例（延遲載入）
 */
async function getHuman() {
  if (humanInstance) return humanInstance;
  
  try {
    logger.info('🔄 Loading @vladmandic/human model...');
    
    // 動態載入以避免在沒有依賴時崩潰
    // @ts-ignore - 動態載入，型別可能不存在
    const { Human } = await import('@vladmandic/human');
    
    // 嘗試使用 node_modules 裡的本地模型
    let modelBasePath = 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/';
    try {
      const { join } = await import('path');
      const { existsSync } = await import('fs');
      // 嘗試找到 node_modules 裡的模型路徑
      const localModelsPath = join(process.cwd(), 'node_modules', '@vladmandic', 'human', 'models');
      if (existsSync(localModelsPath)) {
        modelBasePath = `file://${localModelsPath.replace(/\\/g, '/')}/`;
        logger.info(`✅ Using local models from: ${localModelsPath}`);
      } else {
        logger.warn(`⚠️ Local models not found at ${localModelsPath}, using CDN`);
      }
    } catch (pathErr) {
      logger.warn('⚠️ Could not resolve local model path, using CDN:', pathErr);
    }
    
    humanInstance = new Human({
      modelBasePath,
      backend: 'cpu', // 在 Electron main process 中使用 CPU 後端
      face: {
        enabled: true,
        detector: { enabled: true, modelPath: 'blazeface.json', maxDetected: 10 },
        mesh: { enabled: false },
        iris: { enabled: false },
        emotion: { enabled: false },
        description: { enabled: true, modelPath: 'faceres.json' }, // 特徵提取
        antispoof: { enabled: false },
      },
    });
    
    logger.info('🔄 Warming up @vladmandic/human model...');
    await humanInstance.warmup(); // 預熱模型
    logger.info('✅ @vladmandic/human model loaded and ready!');
    
    return humanInstance;
  } catch (err: any) {
    logger.error(`❌ Failed to load @vladmandic/human: ${err?.message || err}`);
    logger.error('❌ Face detection will NOT work. All photos will get deterministic (non-face) embeddings.');
    logger.error('❌ This means photo matching will NOT produce meaningful results!');
    return null;
  }
}

/**
 * 從圖片檔案偵測臉部並提取特徵
 */
export async function detectFaces(
  imagePath: string,
  options: DetectorOptions = {}
): Promise<FaceDetection[]> {
  const human = await getHuman();
  
  // 如果 Human 未載入，回傳空陣列（將使用 deterministic embedding 作為 fallback）
  if (!human) {
    logger.debug('Human model not available, skipping face detection');
    return [];
  }

  try {
    logger.debug(`Processing image for face detection: ${imagePath}`);
    
    // 在 Electron main process 中，使用 sharp 載入圖片並轉換為適合的格式
    const sharp = (await import('sharp')).default;
    
    // Handle different image formats
    let sharpInstance = sharp(imagePath);
    const isHeic = imagePath.toLowerCase().endsWith('.heic') || imagePath.toLowerCase().endsWith('.heif');
    
    if (isHeic) {
      try {
        sharpInstance = sharp(imagePath, { sequentialRead: true });
      } catch (heicError) {
        logger.warn(`Failed to process HEIC file ${imagePath}:`, heicError);
        throw new AppError(
          `HEIC format not supported for face detection: ${imagePath}`,
          'HEIC_NOT_SUPPORTED',
          { originalError: heicError }
        );
      }
    }
    
    const imageBuffer = await sharpInstance
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    // 使用 Human 的 TensorFlow.js 後端處理圖片
    const tensor = await human.tf.node.decodeImage(imageBuffer, 3); // RGB
    const result = await human.detect(tensor);
    tensor.dispose(); // 釋放記憶體

    const detections: FaceDetection[] = [];
    const { enableAgeGender = false, minConfidence = 0.3 } = options;

    if (result.face && result.face.length > 0) {
      logger.debug(`Found ${result.face.length} face(s) in ${imagePath}`);
      
      for (const face of result.face) {
        if (face.score < minConfidence) {
          logger.debug(`Skipping face with low confidence: ${face.score} < ${minConfidence}`);
          continue;
        }

        // 提取特徵向量
        let embedding: number[] = [];
        if (face.embedding && face.embedding.length > 0) {
          embedding = Array.from(face.embedding);
        }

        // 邊界框 [x, y, width, height]
        const bbox: [number, number, number, number] = [
          face.box[0], // x
          face.box[1], // y
          face.box[2] - face.box[0], // width
          face.box[3] - face.box[1], // height
        ];

        const detection: FaceDetection = {
          bbox,
          embedding: embedding.length > 0 ? embedding : [],
          confidence: face.score,
        };

        // 可選的年齡和性別
        if (enableAgeGender && face.age) {
          detection.age = face.age;
        }
        if (enableAgeGender && face.gender !== undefined) {
          detection.gender = face.gender === 0 ? 'female' : 'male';
        }

        detections.push(detection);
      }
    } else {
      logger.debug(`No faces detected in ${imagePath}`);
    }

    return detections;
  } catch (err) {
    logger.error(`Face detection failed for ${imagePath}:`, err);
    throw new AppError(
      `Face detection failed for ${imagePath}`,
      'FACE_DETECTION_ERROR',
      { originalError: err }
    );
  }
}

/**
 * 從圖片中提取主要臉部的特徵向量（用於比對）
 * 如果沒有偵測到臉部，回傳 null
 */
export async function extractFaceEmbedding(
  imagePath: string,
  options: DetectorOptions = {}
): Promise<number[] | null> {
  const faces = await detectFaces(imagePath, options);
  
  if (faces.length === 0) {
    return null;
  }

  // 使用信心度最高的臉部
  const bestFace = faces.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );

  return bestFace.embedding.length > 0 ? bestFace.embedding : null;
}

