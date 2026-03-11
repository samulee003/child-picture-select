/**
 * 兒童發育階段偵測模組
 * 根據面部特徵判斷兒童的發育階段（嬰兒、幼兒、兒童）
 */

import { logger } from '../utils/logger';
import type { FaceDetection, DetectorOptions } from './detector';
import type { ChildDetection } from './childDetector';

export interface DevelopmentStage {
  /** 發育階段 */
  stage: 'infant' | 'toddler' | 'child' | 'adolescent' | 'adult';
  
  /** 階段置信度 */
  confidence: number;
  
  /** 估計年齡範圍 */
  ageRange: {
    min: number;
    max: number;
  };
  
  /** 階段特徵描述 */
  description: string;

  /** 阶段特徵 */
  facialFeatures: {
    faceShape: 'round' | 'oval' | 'heart' | 'square' | 'oblong';
    eyeRatio: number;
    skinSmoothness: number;
    featureless?: boolean;
    chubbyCheeks?: boolean;
    definedFeatures?: boolean;
    facialHair?: boolean;
    wrinkles?: boolean;
  };
}

type DevelopmentStageTemplate = Omit<DevelopmentStage, 'confidence'> & {
  facialFeatures: NonNullable<DevelopmentStage['facialFeatures']>;
};

export interface ChildDevelopmentOptions extends DetectorOptions {
  /** 是否啟用兒童發育階段偵測 */
  developmentMode?: boolean;
  
  /** 年齡範圍限制 */
  ageRange?: { min: number; max: number };
}

/**
 * 兒童發育階段分析器
 */
export class ChildDevelopmentDetector {
  private static readonly DEVELOPMENT_STAGES: Record<string, DevelopmentStageTemplate> = {
    infant: {
      stage: 'infant' as const,
      ageRange: { min: 0, max: 2 },
      description: '嬰兒期 (0-2歲)',
      facialFeatures: {
        faceShape: 'round',
        eyeRatio: 0.25,      // 大眼睛比例
        skinSmoothness: 0.9,     // 光滑皮膚
        featureless: true       // 特徵不明顯
      }
    },
    toddler: {
      stage: 'toddler' as const,
      ageRange: { min: 2, max: 5 },
      description: '幼兒期 (2-5歲)',
      facialFeatures: {
        faceShape: 'round',
        eyeRatio: 0.3,       // 較大眼睛比例
        skinSmoothness: 0.8,     // 光滑皮膚
        chubbyCheeks: true    // 豐滿臉頰
      }
    },
    child: {
      stage: 'child' as const,
      ageRange: { min: 6, max: 12 },
      description: '兒童期 (6-12歲)',
      facialFeatures: {
        faceShape: 'oval',
        eyeRatio: 0.35,      // 適中眼睛比例
        skinSmoothness: 0.7,     // 較光滑皮膚
        definedFeatures: true   // 明顯的五官特徵
      }
    },
    adolescent: {
      stage: 'adolescent' as const,
      ageRange: { min: 13, max: 18 },
      description: '青少年期 (13-18歲)',
      facialFeatures: {
        faceShape: 'heart',
        eyeRatio: 0.4,       // 接近成人比例
        skinSmoothness: 0.6,     // 開始有青春痘
        facialHair: true      // 開始出現面部毛髮
      }
    },
    adult: {
      stage: 'adult' as const,
      ageRange: { min: 19, max: 100 },
      description: '成人期 (19歲以上)',
      facialFeatures: {
        faceShape: 'oblong',
        eyeRatio: 0.45,      // 成人眼睛比例
        skinSmoothness: 0.5,     // 較粗糙皮膚
        facialHair: true,      // 明顯的面部毛髮
        wrinkles: true       // 皺紋出現
      }
    }
  };

  /**
   * 分析面部特徵判斷發育階段
   */
  private static analyzeDevelopmentStage(
    detection: FaceDetection,
    embedding: number[]
  ): DevelopmentStage {
    const features = this.extractDevelopmentFeatures(detection, embedding);
    
    // 基於年齡特徵初步判斷
    let bestStage = this.DEVELOPMENT_STAGES.adult;
    let bestScore = 0;
    
    for (const [stageKey, stage] of Object.entries(this.DEVELOPMENT_STAGES)) {
      const score = this.calculateStageScore(features, stage);
      
      if (score > bestScore) {
        bestScore = score;
        bestStage = stage;
      }
    }
    
    return {
      ...bestStage,
      confidence: bestScore,
      ageRange: bestStage.ageRange,
      description: bestStage.description
    };
  }

  /**
   * 提取發育階段相關特徵
   */
  private static extractDevelopmentFeatures(
    detection: FaceDetection,
    embedding: number[]
  ): DevelopmentStage['facialFeatures'] {
    // 基於特徵向量分析發育特徵
    if (embedding.length < 50) {
      return {
        faceShape: 'round',
        eyeRatio: 0.4,
        skinSmoothness: 0.6,
        featureless: true
      };
    }
    
    // 這裡可以添加更複雜的特徵提取邏輯
    const faceWidth = detection.bbox[2] - detection.bbox[0];
    const faceHeight = detection.bbox[3] - detection.bbox[1];
    const faceAspectRatio = faceWidth / faceHeight;
    
    // 基於面部比例和特徵向量判斷
    let faceShape: DevelopmentStage['facialFeatures']['faceShape'] = 'oval';
    let eyeRatio = 0.4;
    let skinSmoothness = 0.6;
    
    // 嬰兒特徵：更圓的臉型，更大的眼睛比例
    if (faceAspectRatio > 0.9) {
      faceShape = 'round';
      eyeRatio = 0.25;
      skinSmoothness = 0.9;
    }
    
    // 兒童特徵：明顯的五官，適中的眼睛比例
    if (faceAspectRatio >= 0.75 && faceAspectRatio <= 0.9) {
      faceShape = 'oval';
      eyeRatio = 0.35;
      skinSmoothness = 0.7;
    }
    
    return {
      faceShape,
      eyeRatio,
      skinSmoothness,
      featureless: false
    };
  }

  /**
   * 計算階段匹配分數
   */
  private static calculateStageScore(
    features: DevelopmentStage['facialFeatures'],
    stage: DevelopmentStageTemplate
  ): number {
    let score = 0;
    
    // 面部形狀匹配
    if (features.faceShape === stage.facialFeatures.faceShape) {
      score += 0.3;
    }
    
    // 眼睛比例匹配
    const eyeRatioDiff = Math.abs(features.eyeRatio - stage.facialFeatures.eyeRatio);
    if (eyeRatioDiff < 0.1) {
      score += 0.25;
    }
    
    // 皮膚光滑度匹配
    const skinSmoothnessDiff = Math.abs(features.skinSmoothness - stage.facialFeatures.skinSmoothness);
    if (skinSmoothnessDiff < 0.15) {
      score += 0.2;
    }
    
    // 特徵明顯度匹配
    if (!features.featureless && stage.facialFeatures.featureless) {
      score -= 0.1;
    }
    
    // 特殊特徵匹配
    if (stage.facialFeatures.chubbyCheeks && features.skinSmoothness > 0.8) {
      score += 0.15;
    }
    
    if (stage.facialFeatures.facialHair && features.skinSmoothness < 0.7) {
      score += 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 偵測面部並分析發育階段
   */
  static async detectDevelopmentStage(
    imagePath: string,
    options: ChildDevelopmentOptions = {}
  ): Promise<DevelopmentStage[]> {
    try {
      logger.debug(`Analyzing development stage for: ${imagePath}`);
      
      // 首先進行標準面部偵測
      const { detectFaces } = await import('./detector');
      const faces = await detectFaces(imagePath, {
        ...options,
        enableAgeGender: true  // 啟用年齡和性別偵測
      });
      
      const stages: DevelopmentStage[] = [];
      
      for (const face of faces) {
        // 為每個偵測到的面部分析發育階段
        const stage = this.analyzeDevelopmentStage(face, face.embedding);
        stages.push(stage);
      }
      
      logger.debug(`Detected ${stages.length} faces, best stage: ${stages[0]?.stage}`);
      
      return stages;
    } catch (error) {
      logger.error(`Failed to analyze development stage: ${imagePath}`, error);
      throw error;
    }
  }

  /**
   * 根據發育階段過濾檢測結果
   */
  static filterByDevelopmentStage(
    detections: FaceDetection[],
    targetStages: DevelopmentStage['stage'][]
  ): FaceDetection[] {
    return detections.filter(detection => {
      // 這裡可以添加更複雜的過濾邏輯
      return true; // 目前返回所有檢測結果，可以根據需要修改
    });
  }

  /**
   * 獲取支持的發育階段列表
   */
  static getSupportedStages(): DevelopmentStage['stage'][] {
    return Object.keys(this.DEVELOPMENT_STAGES) as DevelopmentStage['stage'][];
  }
}