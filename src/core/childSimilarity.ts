/**
 * 兒童專門的相似度計算算法
 * 針對兒童面部特徵進行優化的相似度評分
 */

import { cosineSimilarity } from './similarity';
import type { ChildDetection } from './childDetector';

export interface ChildSimilarityOptions {
  /** 是否啟用兒童專門模式 */
  childMode?: boolean;
  
  /** 兒童年齡範圍（用於過濾） */
  childAgeRange?: { min: number; max: number };
  
  /** 相似度計算策略 */
  strategy?: 'standard' | 'child-optimized' | 'hybrid';
  
  /** 兒童特徵權重 */
  featureWeights?: {
    faceShape: number;      // 臉型權重
    eyeRatio: number;        // 眼眼比例權重
    skinSmoothness: number;  // 膚膚光滑度權重
    age: number;            // 年齡匹配權重
  };
}

export class ChildSimilarityCalculator {
  private options: ChildSimilarityOptions;
  
  constructor(options: ChildSimilarityOptions = {}) {
    this.options = {
      childMode: true,
      childAgeRange: { min: 3, max: 18 },
      strategy: 'child-optimized',
      featureWeights: {
        faceShape: 0.3,    // 兒童臉型更圓
        eyeRatio: 0.25,   // 兒童眼睛比例更大
        skinSmoothness: 0.2, // 兒童膚膚更光滑
        age: 0.25           // 年齡匹配權重
      },
      ...options
    };
  }
  
  /**
   * 計算兒童專門的相似度
   * 結合標準相似度和兒童特徵評分
   */
  calculateSimilarity(
    referenceEmbedding: number[],
    targetEmbedding: number[],
    targetDetection?: ChildDetection
  ): number {
    const { strategy, childMode, featureWeights } = this.options;
    
    // 計算標準餘弦相似度
    const standardSimilarity = cosineSimilarity(referenceEmbedding, targetEmbedding);
    
    if (strategy === 'standard' || !childMode) {
      return standardSimilarity;
    }
    
    // 兒童專門模式
    if (strategy === 'child-optimized') {
      return this.calculateChildOptimizedSimilarity(
        referenceEmbedding,
        targetEmbedding,
        targetDetection,
        featureWeights
      );
    }
    
    // 混合模式
    if (strategy === 'hybrid') {
      const childScore = this.calculateChildOptimizedSimilarity(
        referenceEmbedding,
        targetEmbedding,
        targetDetection,
        featureWeights
      );
      
      // 混合標準相似度和兒童評分
      return standardSimilarity * 0.6 + childScore * 0.4;
    }
    
    return standardSimilarity;
  }
  
  /**
   * 計算兒童優化的相似度
   */
  private calculateChildOptimizedSimilarity(
    referenceEmbedding: number[],
    targetEmbedding: number[],
    targetDetection: ChildDetection | undefined,
    featureWeights: ChildSimilarityOptions['featureWeights']
  ): number {
    const standardSimilarity = cosineSimilarity(referenceEmbedding, targetEmbedding);
    let childBonus = 0;
    
    // 年齡匹配獎勵
    if (targetDetection?.childAge && this.options.childAgeRange) {
      const { min, max } = this.options.childAgeRange;
      if (targetDetection.childAge >= min && targetDetection.childAge <= max) {
        childBonus += 0.15; // 年齡匹配獎勵
      }
    }
    
    // 兒童特徵匹配獎勵
    if (targetDetection?.isChild && targetDetection.childFeatures) {
      const features = targetDetection.childFeatures;
      const weights = featureWeights || this.options.featureWeights || {
        faceShape: 0.3,
        eyeRatio: 0.25,
        skinSmoothness: 0.2,
        age: 0.25
      };
      
      // 臉型匹配（圓形對兒童更有利）
      if (features.faceShape === 'round') {
        childBonus += weights.faceShape * 0.1;
      }
      
      // 眼眼比例匹配
      const idealEyeRatio = 0.35; // 兒童理想眼眼比例
      const eyeRatioDiff = Math.abs(features.eyeRatio - idealEyeRatio);
      if (eyeRatioDiff < 0.1) {
        childBonus += weights.eyeRatio * 0.1;
      }
      
      // 膚膚光滑度匹配
      if (features.skinSmoothness > 0.6) {
        childBonus += weights.skinSmoothness * 0.1;
      }
      
      // 鼻子到嘴巴距離比例匹配
      if (features.noseToMouthRatio > 0.15 && features.noseToMouthRatio < 0.25) {
        childBonus += 0.05; // 兒童面部比例特徵
      }
    }
    
    // 兒童置信度加權
    if (targetDetection?.childConfidence) {
      const confidenceBonus = targetDetection.childConfidence * 0.1;
      childBonus += confidenceBonus;
    }
    
    // 最終相似度 = 標準相似度 + 兒童特徵獎勵
    const finalSimilarity = Math.min(1.0, standardSimilarity + childBonus);
    
    return finalSimilarity;
  }
  
  /**
   * 根據兒童特徵動態調整門檻值
   */
  calculateAdaptiveThreshold(
    referenceDetections: ChildDetection[],
    baseThreshold: number = 0.6
  ): number {
    if (!this.options.childMode) {
      return baseThreshold;
    }
    
    // 分析參考照片的兒童特徵分佈
    const childFeatureScores = referenceDetections
      .filter(detection => detection.isChild)
      .map(detection => {
        let score = 0;
        
        if (detection.childFeatures) {
          const features = detection.childFeatures;
          const weights = this.options.featureWeights || this.options.featureWeights;
          
          // 高質量兒童特徵降低門檻
          if (features.faceShape === 'round') score -= 0.05;
          if (features.skinSmoothness > 0.7) score -= 0.05;
          if (detection.childConfidence && detection.childConfidence > 0.8) score -= 0.05;
        }
        
        return score;
      });
    
    // 如果參考照片中兒童特徵明顯，降低門檻
    const avgChildScore = childFeatureScores.reduce((sum, score) => sum + score, 0) / childFeatureScores.length;
    
    if (avgChildScore > 0.3) {
      // 高質量兒童參考，可以降低門檻提高準確率
      return Math.max(0.4, baseThreshold - 0.1);
    } else if (avgChildScore < 0.1) {
      // 兒童特徵不明顯，提高門檻避免誤判
      return Math.min(0.8, baseThreshold + 0.1);
    }
    
    return baseThreshold;
  }
  
  /**
   * 更新配置選項
   */
  updateOptions(newOptions: Partial<ChildSimilarityOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}