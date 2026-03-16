/**
 * 兒童照片質量評估系統
 * 評估照片質量並提供改進建議
 */

import { logger } from '../utils/logger';
import sharp from 'sharp';

type SharpMetadata = Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
type SharpStats = Awaited<ReturnType<ReturnType<typeof sharp>['stats']>>;

export interface QualityMetrics {
  /** 整體質量評分 (0-100) */
  overallScore: number;
  
  /** 銳度評分 (0-100) */
  sharpness: number;
  
  /** 對比度評分 (0-100) */
  contrast: number;
  
  /** 曝光評分 (0-100) */
  exposure: number;
  
  /** 噪點評分 (0-100，越低越好) */
  noise: number;
  
  /** 分辨率評分 (0-100) */
  resolution: number;
  
  /** 面部清晰度評分 (0-100) */
  faceClarity: number;
  
  /** 質量建議 */
  recommendations: string[];
}

export interface QualityAssessmentOptions {
  /** 是否啟用詳細分析 */
  detailedAnalysis?: boolean;
  
  /** 質量評估級別 */
  qualityLevel?: 'basic' | 'standard' | 'professional';
}

/**
 * 兒童照片質量評估器
 */
export class ChildQualityAssessor {
  private options: QualityAssessmentOptions;
  
  constructor(options: Partial<QualityAssessmentOptions> = {}) {
    this.options = {
      detailedAnalysis: false,
      qualityLevel: 'standard',
      ...options
    };
  }
  
  /**
   * 評估單張照片的質量
   */
  async assessPhotoQuality(imagePath: string): Promise<QualityMetrics> {
    try {
      logger.debug(`Assessing photo quality: ${imagePath}`);
      
      // 使用 sharp 獲取圖片元數據
      const metadata = await sharp(imagePath).metadata();
      const stats = await sharp(imagePath).stats();
      
      // 計算各項質量指標
      const metrics = await this.calculateQualityMetrics(metadata, stats, imagePath);
      
      // 生成改進建議
      const recommendations = this.generateRecommendations(metrics);
      
      logger.debug(`Quality assessment completed: ${JSON.stringify(metrics)}`);
      
      return {
        ...metrics,
        recommendations
      };
    } catch (error) {
      logger.error(`Failed to assess photo quality: ${imagePath}`, error);
      throw error;
    }
  }
  
  /**
   * 計算質量指標
   */
  private async calculateQualityMetrics(
    metadata: SharpMetadata,
    stats: SharpStats,
    imagePath: string
  ): Promise<Omit<QualityMetrics, 'recommendations'>> {
    const { width, height } = metadata;
    const { channels } = stats;
    
    // 銳度評估（基於邊緣檢測）
    const sharpness = await this.estimateSharpness(metadata, stats);
    
    // 對比度評估（基於直方圖分析）
    const contrast = await this.estimateContrast(stats);
    
    // 曝光評估（基於亮度分佈）
    const exposure = await this.estimateExposure(stats);
    
    // 噪點評估（基於平滑度分析）
    const noise = await this.estimateNoise(stats);
    
    // 分辨率評估
    const resolution = this.calculateResolutionScore(width, height);
    
    // 面部清晰度評估（需要面部檢測）
    const faceClarity = await this.estimateFaceClarity(imagePath);
    
    return {
      overallScore: this.calculateOverallScore({
        sharpness,
        contrast,
        exposure,
        noise,
        resolution,
        faceClarity
      }),
      sharpness,
      contrast,
      exposure,
      noise,
      resolution,
      faceClarity
    };
  }
  
  /**
   * 估計圖片銳度
   */
  private async estimateSharpness(
    metadata: SharpMetadata,
    stats: SharpStats
  ): Promise<number> {
    // 基於邊緣檢測的簡單銳度評估
    // 銳度越高，邊緣變化越大
    const edgeVariance = this.calculateEdgeVariance(stats);
    
    // 銳度評分 (0-100，越高越好)
    const sharpnessScore = Math.max(0, Math.min(100, 100 - edgeVariance * 10));
    
    return sharpnessScore;
  }
  
  /**
   * 估計對比度
   */
  private async estimateContrast(stats: SharpStats): Promise<number> {
    // 基於直方圖分佈的對比度評估
    const histogram = await this.calculateHistogram(stats);
    const contrast = this.calculateContrastFromHistogram(histogram);
    
    // 對比度評分 (0-100)
    const contrastScore = Math.min(100, Math.max(0, contrast * 2));
    
    return contrastScore;
  }
  
  /**
   * 估計曝光
   */
  private async estimateExposure(stats: SharpStats): Promise<number> {
    // 基於亮度分佈的曝光評估
    const mean = stats.mean;
    
    // 理想亮度範圍 (對於兒童照片）
    const idealMean = 128;
    
    // 曝光評分 (0-100，接近理想值越好)
    const exposureScore = Math.max(0, 100 - Math.abs(mean - idealMean) / 128 * 100);
    
    return exposureScore;
  }
  
  /**
   * 估計噪點
   */
  private async estimateNoise(stats: SharpStats): Promise<number> {
    // 基於平滑度分析的噪點評估
    // 噪點越多，平滑度越低
    const smoothness = this.estimateSmoothness(stats);
    
    // 噪點評分 (0-100，越低越好)
    const noiseScore = Math.max(0, smoothness * 100);
    
    return noiseScore;
  }
  
  /**
   * 計算分辨率評分
   */
  private calculateResolutionScore(width: number, height: number): number {
    // 對於兒童照片，適中的分辨率比較重要
    const minResolution = Math.min(width, height);
    
    // 分辨率評分 (0-100)
    if (minResolution >= 1080) return 100;      // 高清
    if (minResolution >= 720) return 80;       // 標清
    if (minResolution >= 480) return 60;       // 基本
    return 40;                                     // 低清
  }
  
  /**
   * 估計面部清晰度
   */
  private async estimateFaceClarity(imagePath: string): Promise<number> {
    try {
      // 使用面部檢測來評估清晰度
      const { detectFaces } = await import('./detector');
      const faces = await detectFaces(imagePath, { minConfidence: 0.3 });
      
      if (faces.length === 0) {
        return 50; // 沒有檢測到面部，給中等分數
      }
      
      // 基於檢測置信度的面部清晰度評估
      const avgConfidence = faces.reduce((sum, face) => sum + face.confidence, 0) / faces.length;
      
      // 面部清晰度評分 (0-100)
      const faceClarityScore = Math.min(100, avgConfidence * 100);
      
      return faceClarityScore;
    } catch (error) {
      logger.warn(`Failed to estimate face clarity: ${imagePath}`, error);
      return 50; // 默認中等分數
    }
  }
  
  /**
   * 計算邊緣方差（以通道標準差作為邊緣強度的代理指標）
   * 標準差越低 → 畫面越平滑 → 越模糊 → edgeVariance 越高
   */
  private calculateEdgeVariance(stats: SharpStats): number {
    const channels = stats.channels;
    if (!channels || channels.length === 0) return 5;
    const avgStdev = channels.reduce((sum: number, ch: { stdev: number }) => sum + ch.stdev, 0) / channels.length;
    // avgStdev 範圍約 0–128；映射為 0–10（值越低 = 越模糊）
    return Math.max(0, 10 - avgStdev / 12.8);
  }

  /**
   * 從通道統計資料建構簡化直方圖
   * 以第一通道的 mean/stdev 近似正態分佈
   */
  private async calculateHistogram(stats: SharpStats): Promise<number[]> {
    const channels = stats.channels;
    if (!channels || channels.length === 0) {
      return new Array(256).fill(0);
    }
    const ch = channels[0];
    const center = Math.round(ch.mean);
    const spread = Math.round(ch.stdev);
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < 256; i++) {
      histogram[i] = Math.max(0, spread - Math.abs(i - center));
    }
    return histogram;
  }
  
  /**
   * 從直方圖計算對比度
   */
  private calculateContrastFromHistogram(histogram: number[]): number {
    // 簡單的對比度計算
    const minValue = Math.min(...histogram);
    const maxValue = Math.max(...histogram);
    
    return maxValue - minValue;
  }
  
  /**
   * 估計平滑度
   */
  private estimateSmoothness(stats: SharpStats): number {
    // 基於標準差的簡單平滑度估計
    // 平滑的圖片標準差較小
    return Math.max(0, 100 - (stats.stdev || 50) * 2);
  }
  
  /**
   * 計算整體質量評分
   */
  private calculateOverallScore(metrics: {
    sharpness: number;
    contrast: number;
    exposure: number;
    noise: number;
    resolution: number;
    faceClarity: number;
  }): number {
    // 根據不同質量指標的重要性加權計算
    const weights = {
      faceClarity: 0.3,    // 面部清晰度最重要
      sharpness: 0.2,       // 銳度很重要
      resolution: 0.15,      // 分辨率重要
      contrast: 0.15,       // 對比度重要
      exposure: 0.1,       // 曝光適中即可
      noise: 0.1          // 噪點控制
    };
    
    const weightedScore = 
      metrics.faceClarity * weights.faceClarity +
      metrics.sharpness * weights.sharpness +
      metrics.resolution * weights.resolution +
      metrics.contrast * weights.contrast +
      metrics.exposure * weights.exposure +
      (100 - metrics.noise) * weights.noise;
    
    return Math.min(100, Math.max(0, weightedScore));
  }
  
  /**
   * 生成改進建議
   */
  private generateRecommendations(metrics: Omit<QualityMetrics, 'recommendations'>): string[] {
    const recommendations: string[] = [];
    
    // 基於各項指標生成建議
    if (metrics.faceClarity < 60) {
      recommendations.push('面部不夠清晰，建議使用更高分辨率的照片');
    }
    
    if (metrics.sharpness < 50) {
      recommendations.push('照片有些模糊，建議重新拍攝或使用圖片增強工具');
    }
    
    if (metrics.contrast < 40) {
      recommendations.push('對比度較低，建議調整拍攝時的光線條件');
    }
    
    if (metrics.exposure < 30 || metrics.exposure > 80) {
      recommendations.push('曝光不理想，建議調整拍攝時的光線');
    }
    
    if (metrics.noise > 50) {
      recommendations.push('照片噪點較多，建議使用更低的ISO值或改善拍攝環境');
    }
    
    if (metrics.resolution < 60) {
      recommendations.push('分辨率較低，建議使用更高分辨率的照片以獲得更好的識別效果');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('照片質量良好，適合用於兒童識別');
    }
    
    return recommendations;
  }
  
  /**
   * 批量評估照片質量
   */
  async assessBatchQuality(imagePaths: string[]): Promise<QualityMetrics[]> {
    logger.debug(`Starting batch quality assessment for ${imagePaths.length} images`);
    
    const results: QualityMetrics[] = [];
    
    for (const imagePath of imagePaths) {
      try {
        const metrics = await this.assessPhotoQuality(imagePath);
        results.push(metrics);
      } catch (error) {
        logger.error(`Failed to assess quality for ${imagePath}:`, error);
        // 為失敗的圖片添加默認評分
        results.push({
          overallScore: 30,
          sharpness: 30,
          contrast: 30,
          exposure: 30,
          noise: 30,
          resolution: 30,
          faceClarity: 30,
          recommendations: ['無法評估照片質量']
        });
      }
    }
    
    logger.debug(`Batch quality assessment completed: ${results.length} images processed`);
    return results;
  }
  
  /**
   * 更新評估選項
   */
  updateOptions(newOptions: Partial<QualityAssessmentOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}