/**
 * 智能參考照片分析系統
 * 自動分析參考照片質量並提供改進建議
 */

import { logger } from '../utils/logger';
import sharp from 'sharp';
import type { ChildDetection } from './childDetector';

export interface PhotoAnalysis {
  /** 整體質量評分 (0-100) */
  overallQuality: number;
  
  /** 質量評分 (0-100) */
  sharpness: number;
  
  /** 對比度評分 (0-100) */
  contrast: number;
  
  /** 曝光評分 (0-100) */
  exposure: number;
  
  /** 分辨率評分 (0-100) */
  resolution: number;
  
  /** 面部檢測評分 (0-100) */
  faceDetection: number;
  
  /** 面部清晰度評分 (0-100) */
  faceClarity: number;
  
  /** 面部角度評分 (0-100) */
  faceAngle: number;
  
  /** 面部大小評分 (0-100) */
  faceSize: number;
  
  /** 兒童特徵評分 (0-100) */
  childFeatures: number;
  
  /** 綜合評分 (0-100) */
  composition: number;
  
  /** 改進建議 */
  recommendations: string[];
  
  /** 分析時間戳 */
  analyzedAt: Date;
}

export interface AnalysisOptions {
  /** 是否啟用詳細分析 */
  detailedAnalysis?: boolean;
  
  /** 是否啟用兒童特徵檢測 */
  childFeatureDetection?: boolean;
  
  /** 分析級別 */
  analysisLevel?: 'basic' | 'standard' | 'comprehensive';
}

/**
 * 智能照片分析器
 */
export class IntelligentPhotoAnalyzer {
  private options: AnalysisOptions;
  
  constructor(options: Partial<AnalysisOptions> = {}) {
    this.options = {
      detailedAnalysis: true,
      childFeatureDetection: true,
      analysisLevel: 'standard',
      ...options
    };
  }
  
  /**
   * 分析單張照片
   */
  async analyzePhoto(imagePath: string): Promise<PhotoAnalysis> {
    try {
      logger.debug(`Starting intelligent photo analysis: ${imagePath}`);
      
      const analysis: PhotoAnalysis = {
        overallQuality: 0,
        sharpness: 0,
        contrast: 0,
        exposure: 0,
        resolution: 0,
        faceDetection: 0,
        faceClarity: 0,
        faceAngle: 0,
        faceSize: 0,
        childFeatures: 0,
        composition: 0,
        recommendations: [],
        analyzedAt: new Date()
      };
      
      // 使用 sharp 獲取圖片元數據
      const metadata = await sharp(imagePath).metadata();
      const stats = await sharp(imagePath).stats();
      
      // 計算基本質量指標
      analysis.sharpness = this.calculateSharpness(stats);
      analysis.contrast = this.calculateContrast(stats);
      analysis.exposure = this.calculateExposure(stats);
      analysis.resolution = this.calculateResolution(metadata);
      
      // 面部檢測和分析
      if (this.options.childFeatureDetection) {
        const faceAnalysis = await this.analyzeFace(imagePath);
        analysis.faceDetection = faceAnalysis.score;
        analysis.faceClarity = faceAnalysis.clarity;
        analysis.faceAngle = faceAnalysis.angle;
        analysis.faceSize = faceAnalysis.size;
        analysis.childFeatures = faceAnalysis.childFeatures;
      }
      
      // 計算兒童特徵評分
      analysis.childFeatures = this.calculateChildFeaturesScore(analysis);
      
      // 計算構圖評分
      analysis.composition = this.calculateCompositionScore(analysis);
      
      // 計算整體質量評分
      analysis.overallQuality = this.calculateOverallScore(analysis);
      
      // 生成改進建議
      analysis.recommendations = this.generateRecommendations(analysis);
      
      logger.debug(`Photo analysis completed: ${JSON.stringify(analysis)}`);
      
      return analysis;
    } catch (error) {
      logger.error(`Failed to analyze photo: ${imagePath}`, error);
      throw error;
    }
  }
  
  /**
   * 批量分析照片
   */
  async analyzeBatch(imagePaths: string[]): Promise<PhotoAnalysis[]> {
    logger.debug(`Starting batch photo analysis for ${imagePaths.length} images`);
    
    const results: PhotoAnalysis[] = [];
    
    for (const imagePath of imagePaths) {
      try {
        const analysis = await this.analyzePhoto(imagePath);
        results.push(analysis);
      } catch (error) {
        logger.error(`Failed to analyze ${imagePath}:`, error);
        // 為失敗的圖片添加默認分析
        results.push({
          overallQuality: 30,
          sharpness: 30,
          contrast: 30,
          exposure: 30,
          resolution: 30,
          faceDetection: 0,
          faceClarity: 30,
          faceAngle: 30,
          faceSize: 30,
          childFeatures: 0,
          composition: 30,
          recommendations: ['無法分析照片，請檢查檔案'],
          analyzedAt: new Date()
        });
      }
    }
    
    logger.debug(`Batch photo analysis completed: ${results.length} images processed`);
    return results;
  }
  
  /**
   * 分析面部特徵
   */
  private async analyzeFace(imagePath: string): Promise<{
    score: number;
    clarity: number;
    angle: number;
    size: number;
    childFeatures: number;
  }> {
    try {
      // 這裡可以集成更複雜的面部分析
      const { detectFaces } = await import('./detector');
      const faces = await detectFaces(imagePath, { minConfidence: 0.3 });
      
      if (faces.length === 0) {
        return {
          score: 0,
          clarity: 0,
          angle: 0,
          size: 0,
          childFeatures: 0
        };
      }
      
      // 選擇最佳面部（最大、最清晰）
      const bestFace = faces.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      // 計算面部清晰度（基於邊緣銳度）
      const edgeSharpness = this.calculateEdgeSharpness(bestFace);
      
      // 計算面部角度（基於邊界框方向）
      const faceAngle = this.calculateFaceAngle(bestFace);
      
      // 計算面部大小（佔圖片比例）
      const metadata = await sharp(imagePath).metadata();
      const faceSize = (bestFace.bbox[2] * bestFace.bbox[3]) / 
        (metadata.width * metadata.height);
      
      // 檢測兒童特徵
      let childFeatures = 0;
      if (this.options.childFeatureDetection) {
      const { ChildFeatureAnalyzer } = await import('./childDetector');
      const analyzedChild = ChildFeatureAnalyzer.analyzeChildFeatures(bestFace);
      childFeatures = (analyzedChild.childConfidence || 0) * 100;
      }
      
      return {
        score: bestFace.confidence,
        clarity: edgeSharpness,
        angle: faceAngle,
        size: faceSize,
        childFeatures
      };
    } catch (error) {
      logger.error(`Failed to analyze face: ${imagePath}`, error);
      return {
        score: 0,
        clarity: 0,
        angle: 0,
        size: 0,
        childFeatures: 0
      };
    }
  }
  
  /**
   * 計算邊緣銳度
   */
  private calculateEdgeSharpness(face: any): number {
    const width = face.bbox[2] - face.bbox[0];
    const height = face.bbox[3] - face.bbox[1];
    
    // 簡單的邊緣銳度計算（越清晰邊緣銳度越高）
    const edgeVariance = this.calculateEdgeVariance(face);
    
    // 銳度評分 (0-100，越高越好)
    return Math.max(0, Math.min(100, 100 - edgeVariance * 50));
  }
  
  /**
   * 計算面部角度
   */
  private calculateFaceAngle(face: any): number {
    // 基於邊界框計算面部角度（簡化實現）
    const width = face.bbox[2] - face.bbox[0];
    const height = face.bbox[3] - face.bbox[1];
    
    // 計算面部中心點偏移（理想情況下應該接近中心）
    const centerX = face.bbox[0] + width / 2;
    const centerY = face.bbox[1] + height / 2;
    
    // 這裡可以添加更複雜的角度計算
    const angle = Math.atan2(centerY - face.bbox[1], centerX - face.bbox[0]) * (180 / Math.PI);
    
    // 角度評分 (0-100，90度為最佳）
    const angleScore = Math.max(0, 100 - Math.abs(angle - 90) / 90 * 100);
    
    return angleScore;
  }
  
  /**
   * 計算邊緣方差
   */
  private calculateEdgeVariance(face: any): number {
    // 這裡可以實現更準確的邊緣方差計算
    return 0; // 簡化實現
  }
  
  /**
   * 計算銳度
   */
  private calculateSharpness(stats: any): number {
    // 基於標準差的簡單銳度計算
    const mean = stats.mean;
    const stdDev = stats.stdev;
    
    // 銳度評分 (0-100，標準差越小越清晰)
    const sharpnessScore = Math.max(0, Math.min(100, 100 - (stdDev / 128) * 100));
    
    return sharpnessScore;
  }
  
  /**
   * 計算對比度
   */
  private calculateContrast(stats: any): number {
    // 基於直方圖的對比度計算
    // 這裡可以實現更準確的對比度計算
    return 50; // 簡化實現，返回中等對比度
  }
  
  /**
   * 計算曝光
   */
  private calculateExposure(stats: any): number {
    // 基於亮度均值的曝光評估
    const idealMean = 128; // 理想亮度值
    
    // 曝光評分 (0-100，接近理想值越好）
    const exposureScore = Math.max(0, 100 - Math.abs(stats.mean - idealMean) / 128 * 100);
    
    return exposureScore;
  }
  
  /**
   * 計算分辨率
   */
  private calculateResolution(metadata: any): number {
    const { width, height } = metadata;
    const totalPixels = width * height;
    
    // 分辨率評分 (0-100)
    if (totalPixels >= 1920 * 1080) return 100; // Full HD
    if (totalPixels >= 1280 * 720) return 80;  // HD
    if (totalPixels >= 640 * 480) return 60;  // Standard Definition
    if (totalPixels >= 480 * 360) return 40;  // Enhanced Definition
    return 20; // 低於標準
  }
  
  /**
   * 計算兒童特徵評分
   */
  private calculateChildFeaturesScore(analysis: any): number {
    if (!analysis.childFeatures) return 0;
    
    let score = 0;
    
    // 兒童特徵評分（可以進一步細化）
    if (analysis.childFeatures > 0.7) score += 30;
    if (analysis.faceSize > 0.3 && analysis.faceSize < 0.7) score += 20; // 適中的面部大小
    if (analysis.faceAngle > 80) score += 10; // 正面角度
    if (analysis.faceClarity > 70) score += 20; // 清晰的面部
    
    return Math.min(100, score);
  }
  
  /**
   * 計算構圖評分
   */
  private calculateCompositionScore(analysis: any): number {
    let score = 50; // 基礎分
    
    // 面部位置評分（中心位置更好）
    if (analysis.faceSize > 0.2 && analysis.faceSize < 0.8) {
      score += 20;
    }
    
    // 構圖平衡評分
    if (analysis.resolution > 60) {
      score += 20;
    }
    
    // 整體質量一致性評分
    const consistencyScore = Math.min(
      analysis.sharpness,
      analysis.contrast,
      analysis.exposure
    ) / 100 * 30;
    
    score += consistencyScore;
    
    return Math.min(100, score);
  }
  
  /**
   * 計算整體質量評分
   */
  private calculateOverallScore(analysis: any): number {
    const weights = {
      faceDetection: 25,    // 面部檢測最重要
      faceClarity: 20,     // 面部清晰度
      childFeatures: 15,     // 兒童特徵匹配
      resolution: 15,        // 分辨率
      composition: 15,       // 構圖質量
      sharpness: 5,         // 銳度
      contrast: 3,          // 對比度
      exposure: 2           // 曝光
    };
    
    let totalScore = 0;
    totalScore += analysis.faceDetection * weights.faceDetection;
    totalScore += analysis.faceClarity * weights.faceClarity;
    totalScore += analysis.childFeatures * weights.childFeatures;
    totalScore += analysis.resolution * weights.resolution;
    totalScore += analysis.composition * weights.composition;
    totalScore += analysis.sharpness * weights.sharpness;
    totalScore += analysis.contrast * weights.contrast;
    totalScore += analysis.exposure * weights.exposure;
    
    return Math.min(100, totalScore);
  }
  
  /**
   * 生成改進建議
   */
  private generateRecommendations(analysis: PhotoAnalysis): string[] {
    const recommendations: string[] = [];
    
    // 基於整體質量的建議
    if (analysis.overallQuality < 30) {
      recommendations.push('照片質量較低，建議使用更高質量的參考照片');
      recommendations.push('考慮在更好的光線條件下拍攝');
    }
    
    // 基於面部檢測的建議
    if (analysis.faceDetection < 50) {
      recommendations.push('照片中未檢測到清晰面部，建議使用正面照片');
      recommendations.push('確保參考照片中包含完整、清晰的面部');
    }
    
    // 基於兒童特徵的建議
    if (analysis.childFeatures < 30) {
      recommendations.push('參考照片中兒童特徵不明顯，建議使用更清晰的兒童照片');
    }
    
    // 基於構圖的建議
    if (analysis.composition < 40) {
      recommendations.push('建議使用構圖更均衡的參考照片');
    }
    
    // 基於技術參數的建議
    if (analysis.resolution < 60) {
      recommendations.push('建議使用更高分辨率的照片以獲得更好的識別效果');
    }
    
    if (analysis.sharpness < 50) {
      recommendations.push('建議避免使用過度模糊或壓縮的照片');
    }
    
    // 基於曝光的建議
    if (analysis.exposure < 40) {
      recommendations.push('照片可能過曝或過暗，建議調整拍攝時的光線');
    }
    
    if (analysis.faceAngle < 60) {
      recommendations.push('建議使用正面角度的參考照片');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('照片質量良好，適合用於識別');
    }
    
    return recommendations;
  }
  
  /**
   * 更新分析選項
   */
  updateOptions(newOptions: Partial<AnalysisOptions>): void {
    this.options = { ...this.options, ...newOptions };
    logger.debug('Photo analyzer options updated:', this.options);
  }
}