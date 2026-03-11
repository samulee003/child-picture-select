/**
 * 自適應門檻值計算系統
 * 根據兒童特徵和照片質量動態調整相似度門檻
 */

import { logger } from '../utils/logger';
import type { ChildDetection } from './childDetector';
import type { ChildSimilarityOptions } from './childSimilarity';

export interface AdaptiveThresholdConfig {
  /** 基礎門檻值 */
  baseThreshold: number;
  
  /** 門檻調整策略 */
  strategy: 'conservative' | 'balanced' | 'aggressive';
  
  /** 質量權重 */
  qualityWeight: number;
  
  /** 兒童特徵權重 */
  childFeatureWeight: number;
  
  /** 最小門檻值 */
  minThreshold: number;
  
  /** 最大門檻值 */
  maxThreshold: number;
}

export interface ThresholdAnalysis {
  /** 推薦的門檻值 */
  recommendedThreshold: number;
  
  /** 預期準確率 */
  expectedAccuracy: number;
  
  /** 預期召回率 */
  expectedRecall: number;
  
  /** 分析說明 */
  reasoning: string;
}

/**
 * 自適應門檻計算器
 */
export class AdaptiveThresholdCalculator {
  private config: AdaptiveThresholdConfig;
  
  constructor(config: Partial<AdaptiveThresholdConfig> = {}) {
    this.config = {
      baseThreshold: 0.6,
      strategy: 'balanced',
      qualityWeight: 0.3,
      childFeatureWeight: 0.7,
      minThreshold: 0.3,
      maxThreshold: 0.9,
      ...config
    };
  }
  
  /**
   * 分析參考照片集併計算最優門檻值
   */
  analyzeReferenceSet(
    referenceDetections: ChildDetection[],
    options: {
      targetAccuracy?: number;
      targetRecall?: number;
    } = {}
  ): ThresholdAnalysis {
    logger.debug('Analyzing reference set for adaptive threshold calculation');
    
    // 計算參考照片的質量分佈
    const qualityScores = referenceDetections.map(detection => {
      let score = 0;
      
      // 基礎質量評分
      if (detection.childConfidence) {
        score += detection.childConfidence * 0.3;
      }
      
      // 兒童特徵評分
      if (detection.isChild && detection.childFeatures) {
        score += this.config.childFeatureWeight;
      }
      
      return score;
    });
    
    const avgQualityScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    
    // 根據質量分佈調整基礎門檻
    let baseThreshold = this.config.baseThreshold;
    
    if (avgQualityScore > 0.7) {
      // 高質量參考照片，可以降低門檻提高準確率
      baseThreshold -= 0.1;
    } else if (avgQualityScore < 0.3) {
      // 低質量參考照片，需要提高門檻避免誤判
      baseThreshold += 0.1;
    }
    
    // 根據策略調整門檻
    let adjustedThreshold = baseThreshold;
    
    switch (this.config.strategy) {
      case 'conservative':
        // 保守策略：優先保證準確率
        adjustedThreshold = Math.max(this.config.minThreshold, baseThreshold - 0.05);
        break;
        
      case 'aggressive':
        // 激進策略：優先保證召回率
        adjustedThreshold = Math.min(this.config.maxThreshold, baseThreshold + 0.05);
        break;
        
      case 'balanced':
        // 平衡策略：根據目標調整
        if (options.targetAccuracy && options.targetRecall) {
          // 根據目標準確率和召回率調整
          const accuracyWeight = options.targetAccuracy / (options.targetAccuracy + options.targetRecall);
          const recallWeight = options.targetRecall / (options.targetAccuracy + options.targetRecall);
          
          if (accuracyWeight > recallWeight) {
            // 更重視準確率
            adjustedThreshold = Math.max(this.config.minThreshold, baseThreshold - 0.03);
          } else {
            // 更重視召回率
            adjustedThreshold = Math.min(this.config.maxThreshold, baseThreshold + 0.03);
          }
        }
        break;
    }
    
    // 計算預期性能指標
    const expectedAccuracy = this.calculateExpectedAccuracy(adjustedThreshold, avgQualityScore);
    const expectedRecall = this.calculateExpectedRecall(adjustedThreshold, avgQualityScore);
    
    const reasoning = this.generateReasoning(
      adjustedThreshold,
      avgQualityScore,
      expectedAccuracy,
      expectedRecall,
      this.config.strategy
    );
    
    logger.debug(`Adaptive threshold analysis: ${JSON.stringify({
      baseThreshold,
      adjustedThreshold,
      avgQualityScore,
      expectedAccuracy,
      expectedRecall,
      strategy: this.config.strategy
    })}`);
    
    return {
      recommendedThreshold: adjustedThreshold,
      expectedAccuracy,
      expectedRecall,
      reasoning
    };
  }
  
  /**
   * 計算預期準確率
   */
  private calculateExpectedAccuracy(
    threshold: number,
    avgQualityScore: number
  ): number {
    // 基於門檻值和質量分數計算預期準確率
    const qualityFactor = Math.max(0.5, avgQualityScore);
    const thresholdFactor = threshold / 0.6; // 標準化到 0-1 範圍
    
    // 經驗公式：準確率 = 質量因子 × 門檻因子
    const accuracy = qualityFactor * thresholdFactor;
    
    return Math.min(0.95, Math.max(0.6, accuracy));
  }
  
  /**
   * 計算預期召回率
   */
  private calculateExpectedRecall(
    threshold: number,
    avgQualityScore: number
  ): number {
    // 召回率與準確率通常呈負相關
    const accuracy = this.calculateExpectedAccuracy(threshold, avgQualityScore);
    
    // 簡單的召回率計算
    const recall = Math.max(0.4, 1.2 - accuracy);
    
    return Math.min(0.95, recall);
  }
  
  /**
   * 生成調整說明
   */
  private generateReasoning(
    threshold: number,
    avgQualityScore: number,
    expectedAccuracy: number,
    expectedRecall: number,
    strategy: string
  ): string {
    const reasons: string[] = [];
    
    // 基礎說明
    reasons.push(`基礎門檻值: ${(threshold * 100).toFixed(1)}%`);
    
    // 質量調整說明
    if (avgQualityScore > 0.6) {
      reasons.push('高質量參考照片，降低門檻以提高準確率');
    } else if (avgQualityScore < 0.3) {
      reasons.push('低質量參考照片，提高門檻以減少誤判');
    }
    
    // 策略說明
    switch (strategy) {
      case 'conservative':
        reasons.push('保守策略：優先保證準確率，減少誤判');
        break;
      case 'aggressive':
        reasons.push('激進策略：優先保證召回率，可能增加誤判');
        break;
      case 'balanced':
        reasons.push('平衡策略：根據目標需求調整準確率和召回率');
        break;
    }
    
    // 性能預期
    reasons.push(`預期準確率: ${(expectedAccuracy * 100).toFixed(1)}%`);
    reasons.push(`預期召回率: ${(expectedRecall * 100).toFixed(1)}%`);
    
    return reasons.join('；');
  }
  
  /**
   * 實時調整門檻值
   */
  calculateDynamicThreshold(
    currentResults: Array<{ score: number; detection?: ChildDetection }>,
    targetResultsCount: number = 100
  ): number {
    if (currentResults.length === 0) return this.config.baseThreshold;
    
    // 計算當前結果的分佈
    const scores = currentResults.map(r => r.score);
    scores.sort((a, b) => b - a);
    
    // 動態調整策略
    const percentile75 = scores[Math.floor(scores.length * 0.75)] || scores[scores.length - 1];
    const percentile90 = scores[Math.floor(scores.length * 0.9)] || scores[scores.length - 1];
    
    // 根據目標結果數量調整
    let adjustmentFactor = 0;
    
    if (targetResultsCount < 50) {
      // 目標結果較少，提高門檻以獲得更多結果
      adjustmentFactor = 0.05;
    } else if (targetResultsCount > 200) {
      // 目標結果較多，降低門檻以提高質量
      adjustmentFactor = -0.05;
    }
    
    // 計算動態門檻
    const dynamicThreshold = percentile75 + adjustmentFactor;
    
    // 確保門檻在合理範圍內
    const finalThreshold = Math.max(
      this.config.minThreshold,
      Math.min(this.config.maxThreshold, dynamicThreshold)
    );
    
    logger.debug(`Dynamic threshold calculation: ${finalThreshold.toFixed(3)} (base: ${this.config.baseThreshold}, adjustment: ${adjustmentFactor})`);
    
    return finalThreshold;
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<AdaptiveThresholdConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug('Adaptive threshold config updated:', this.config);
  }
}