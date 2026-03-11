/**
 * 兒童專門面部偵測模組
 * 針對兒童面部特徵進行優化偵測
 */

import { logger } from '../utils/logger';
import type { FaceDetection, DetectorOptions } from './detector';

export interface ChildDetection extends FaceDetection {
  /** 兒童年齡估計 (0-18歲) */
  childAge?: number;
  
  /** 是否為兒童 (基於面部特徵判斷) */
  isChild?: boolean;
  
  /** 兒童特徵置信度 */
  childConfidence?: number;
  
  /** 面部特徵向量 (兒童優化) */
  childFeatures?: {
    /** 臉型比例 (兒童通常較圓) */
    faceShape: 'round' | 'oval' | 'square';
    
    /** 眼睛比例 (兒童眼睛較大) */
    eyeRatio: number;
    
    /** 鼻子到嘴巴距離比例 */
    noseToMouthRatio: number;
    
    /** 膚膚光滑度 */
    skinSmoothness: number;
  };
}

export interface ChildDetectorOptions extends DetectorOptions {
  /** 是否啟用兒童專門模式 */
  childMode?: boolean;
  
  /** 兒童年齡範圍 (用於過濾) */
  childAgeRange?: { min: number; max: number };
  
  /** 兒童特徵提取級別 */
  childFeatureLevel?: 'basic' | 'detailed';
}

/**
 * 兒童面部特徵分析器
 */
export class ChildFeatureAnalyzer {
  /**
   * 分析面部特徵判斷是否為兒童
   */
  static analyzeChildFeatures(detection: FaceDetection): ChildDetection {
    const childDetection: ChildDetection = { ...detection };
    
    // 基於面部比例判斷年齡
    const faceWidth = detection.bbox[2] - detection.bbox[0];
    const faceHeight = detection.bbox[3] - detection.bbox[1];
    const faceAspectRatio = faceWidth / faceHeight;
    
    // 兒童面部特徵：較圓的臉型、較大的眼睛比例
    const isChildFace = this.detectChildFace(faceAspectRatio, detection.embedding);
    
    if (isChildFace) {
      childDetection.isChild = true;
      childDetection.childAge = this.estimateChildAge(detection.embedding);
      childDetection.childConfidence = this.calculateChildConfidence(detection.embedding);
      childDetection.childFeatures = this.extractChildFeatures(detection.embedding);
    }
    
    return childDetection;
  }
  
  /**
   * 基於面部比例和特徵向量判斷是否為兒童面部
   */
  private static detectChildFace(faceAspectRatio: number, embedding: number[]): boolean {
    // 兒童面部通常更圓 (aspect ratio closer to 1)
    const isRoundFace = faceAspectRatio > 0.85 && faceAspectRatio < 1.2;
    
    // 基於特徵向量分析 (兒童面部特徵)
    const hasChildFeatures = this.hasChildFacialFeatures(embedding);
    
    return isRoundFace || hasChildFeatures;
  }

  private static hasChildFacialFeatures(embedding: number[]): boolean {
    return this.calculateChildScore(embedding) >= 0.5;
  }
  
  /**
   * 估計兒童年齡
   */
  private static estimateChildAge(embedding: number[]): number | undefined {
    // 這裡可以集成更複雜的年齡估計算法
    // 目前使用簡單的特徵向量分析
    if (embedding.length < 100) return undefined;
    
    // 基於特徵向量的某些維度估計年齡
    const ageIndicators = this.extractAgeIndicators(embedding);
    const estimatedAge = this.combineAgeIndicators(ageIndicators);
    
    return estimatedAge;
  }
  
  /**
   * 計算兒童置信度
   */
  private static calculateChildConfidence(embedding: number[]): number {
    const childScore = this.calculateChildScore(embedding);
    return Math.min(0.95, Math.max(0.5, childScore));
  }
  
  /**
   * 提取兒童面部特徵
   */
  private static extractChildFeatures(embedding: number[]): ChildDetection['childFeatures'] {
    return {
      faceShape: this.analyzeFaceShape(embedding),
      eyeRatio: this.analyzeEyeRatio(embedding),
      noseToMouthRatio: this.analyzeNoseToMouthRatio(embedding),
      skinSmoothness: this.analyzeSkinSmoothness(embedding)
    };
  }
  
  /**
   * 計算兒童面部評分
   */
  private static calculateChildScore(embedding: number[]): number {
    let score = 0;
    
    // 基於多個特徵維度計算兒童可能性
    for (let i = 0; i < Math.min(embedding.length, 128); i += 4) {
      const value = embedding[i];
      
      // 兒童特徵模式檢測
      if (this.isChildlikeFeature(value, i)) {
        score += 0.02;
      }
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * 檢測是否為兒童特徵
   */
  private static isChildlikeFeature(value: number, index: number): boolean {
    // 這裡實現具體的兒童特徵檢測邏輯
    // 可以根據特徵向量中的特定模式判斷
    
    // 簡單的啟發式檢測（可以進一步優化）
    const childFeatureRanges = [
      { start: 0.1, end: 0.3 },   // 兒童眼部特徵範圍
      { start: 0.4, end: 0.6 },   // 兒童膚膚特徵範圍
      { start: 0.7, end: 0.9 },   // 兒童臉型特徵範圍
    ];
    
    for (const range of childFeatureRanges) {
      if (value >= range.start && value <= range.end) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 分析臉型
   */
  private static analyzeFaceShape(embedding: number[]): 'round' | 'oval' | 'square' {
    // 基於特徵向量分析臉型（簡化實現）
    if (embedding.length < 8) return 'oval';
    
    const faceShapeIndex = Math.abs(embedding[0] % 3);
    const shapes: ('round' | 'oval' | 'square')[] = ['round', 'oval', 'square'];
    return shapes[Math.floor(faceShapeIndex) as number];
  }
  
  /**
   * 分析眼眼比例
   */
  private static analyzeEyeRatio(embedding: number[]): number {
    if (embedding.length < 12) return 0.3;
    
    // 基於特徵向量中的眼部相關維度計算
    const eyeFeatureStart = 8; // 假設眼部特徵從第8維開始
    const eyeFeatureEnd = 12;
    let eyeSum = 0;
    
    for (let i = eyeFeatureStart; i < Math.min(embedding.length, eyeFeatureEnd); i++) {
      eyeSum += Math.abs(embedding[i]);
    }
    
    return eyeSum / (eyeFeatureEnd - eyeFeatureStart);
  }
  
  /**
   * 分析鼻子到嘴巴距離比例
   */
  private static analyzeNoseToMouthRatio(embedding: number[]): number {
    if (embedding.length < 16) return 0.15;
    
    // 基於特徵向量中的面部中下部特徵
    const midFaceStart = 12;
    const midFaceEnd = 16;
    let midFaceSum = 0;
    
    for (let i = midFaceStart; i < Math.min(embedding.length, midFaceEnd); i++) {
      midFaceSum += Math.abs(embedding[i]);
    }
    
    return midFaceSum / (midFaceEnd - midFaceStart);
  }
  
  /**
   * 分析膚膚光滑度
   */
  private static analyzeSkinSmoothness(embedding: number[]): number {
    if (embedding.length < 20) return 0.7;
    
    // 基於特徵向量中的膚膚相關維度
    const skinFeatureStart = 16;
    const skinFeatureEnd = 20;
    let skinSum = 0;
    
    for (let i = skinFeatureStart; i < Math.min(embedding.length, skinFeatureEnd); i++) {
      skinSum += Math.abs(embedding[i]);
    }
    
    return Math.min(0.9, skinSum / (skinFeatureEnd - skinFeatureStart));
  }
  
  /**
   * 提取年齡指示特徵
   */
  private static extractAgeIndicators(embedding: number[]): number[] {
    const indicators: number[] = [];
    
    // 提取與年齡相關的特徵維度
    const ageIndices = [4, 8, 12, 16, 24, 32, 48, 64, 96]; // 假設這些索引對應年齡特徵
    
    for (const index of ageIndices) {
      if (index < embedding.length) {
        indicators.push(embedding[index]);
      }
    }
    
    return indicators;
  }
  
  /**
   * 結合年齡指示特徵估計年齡
   */
  private static combineAgeIndicators(indicators: number[]): number {
    if (indicators.length === 0) return 8; // 預設年齡
    
    // 簡單的加權平均（可以進一步優化）
    const weights = [0.1, 0.15, 0.2, 0.25, 0.15, 0.1, 0.05]; // 不同特徵的權重
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < Math.min(indicators.length, weights.length); i++) {
      weightedSum += indicators[i] * weights[i];
      totalWeight += weights[i];
    }
    
    const estimatedAge = weightedSum / totalWeight;
    
    // 將估計年齡限制在合理範圍內
    return Math.max(0, Math.min(18, Math.round(estimatedAge)));
  }
}