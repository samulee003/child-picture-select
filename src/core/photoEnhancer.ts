/**
 * 照片智能增强模块
 * 自動優化參考照片品質
 */

import sharp from 'sharp';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';
import { getThumbsDir } from './db';

/**
 * 增强选项
 */
export interface EnhancementOptions {
  brightness?: number; // 亮度调整 (0.5-2.0)
  contrast?: number; // 对比度调整 (0.5-1.5)
  sharpen?: {
    amount?: number; // 锐化强度 (0-1)
    radius?: number; // 锐化半径 (像素)
  };
  cropToFit?: {
    targetWidth?: number; // 目标宽度
    targetHeight?: number; // 目标高度
  };
  normalize?: boolean; // 自動歸一化
}

/**
 * 智能增强结果
 */
export interface EnhancedPhoto {
  originalPath: string;
  enhancedPath: string;
  enhancements: string[];
}

/**
 * 照片智能增强器
 */
export class PhotoEnhancer {
  private tempDir: string | null = null;

  private ensureTempDir(): string {
    if (!this.tempDir) {
      this.tempDir = join(getThumbsDir(), 'enhanced');
      if (!existsSync(this.tempDir)) {
        mkdirSync(this.tempDir, { recursive: true });
        logger.info(`Created enhanced photos temp directory: ${this.tempDir}`);
      }
    }
    return this.tempDir;
  }

  /**
   * 智能增强单张照片
   */
  async enhancePhoto(photoPath: string, options: EnhancementOptions = {}): Promise<EnhancedPhoto> {
    try {
      logger.info(`Enhancing photo: ${photoPath}`);

      // 读取图片
      const imageBuffer = await sharp(photoPath).toBuffer();
      let enhancedImage = sharp(imageBuffer);

      const enhancements: string[] = [];

      // 1. 自動旋轉（依照 EXIF）
      enhancedImage = enhancedImage.rotate();

      // 2. 增强亮度和对比度（如果需要）
      // stats.channels 提供每通道統計；sharp v0.33+ 不再有頂層 mean/stdev
      const photoStats = await sharp(photoPath).stats();
      const channels = photoStats.channels;
      const mean =
        channels && channels.length > 0
          ? channels.reduce((s, ch) => s + ch.mean, 0) / channels.length
          : 128;
      const stdev =
        channels && channels.length > 0
          ? channels.reduce((s, ch) => s + ch.stdev, 0) / channels.length
          : 50;

      // 理想亮度范围 (对于儿童照片)
      const idealMean = 180; // 稍微偏亮
      const brightnessAdjustment = Math.min(1.5, Math.max(0.7, idealMean / (mean || 128)));

      if (brightnessAdjustment > 1.05 || brightnessAdjustment < 0.95) {
        enhancedImage = enhancedImage.modulate({
          brightness: brightnessAdjustment,
        });
        enhancements.push(`亮度調整: ${brightnessAdjustment.toFixed(2)}x`);
        logger.debug(`Applied brightness adjustment: ${brightnessAdjustment}`);
      }

      // 3. 自動對比度增強
      const contrastAdjustment = Math.min(1.2, Math.max(0.9, 1 + stdev / 256));
      if (contrastAdjustment !== 1) {
        enhancedImage = enhancedImage.linear(contrastAdjustment, 0);
        enhancements.push(`對比度調整: ${contrastAdjustment.toFixed(2)}x`);
        logger.debug(`Applied contrast adjustment: ${contrastAdjustment}`);
      }

      // 4. 锐化
      if (options.sharpen?.amount) {
        enhancedImage = enhancedImage.sharpen({
          sigma: options.sharpen.radius || 1,
          xfactor: options.sharpen.amount * 10,
        });
        enhancements.push(`銳化: ${options.sharpen.amount.toFixed(2)}`);
        logger.debug(`Applied sharpening: ${options.sharpen.amount}`);
      }

      // 5. 限制最大尺寸（避免过大文件）
      const metadata = await sharp(photoPath).metadata();
      const maxDimension = 1920;
      const width = metadata.width || 1920;
      const height = metadata.height || 1080;

      if (width > maxDimension || height > maxDimension) {
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);

        enhancedImage = enhancedImage.resize({
          width: newWidth,
          height: newHeight,
          fit: 'inside',
          withoutEnlargement: true,
        });
        enhancements.push(`調整尺寸: ${newWidth}x${newHeight}`);
        logger.debug(`Resized to: ${newWidth}x${newHeight}`);
      }

      // 6. 输出增强后的图片
      const basename = `enhanced_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const outputPath = join(this.ensureTempDir(), basename);

      await enhancedImage
        .jpeg({
          quality: 85,
          progressive: true,
          optimizeScans: true,
        })
        .toFile(outputPath);

      logger.info(`Photo enhanced successfully: ${outputPath}`);

      return {
        originalPath: photoPath,
        enhancedPath: outputPath,
        enhancements,
      };
    } catch (error) {
      logger.error(`Failed to enhance photo: ${photoPath}`, error);
      throw new AppError(`Failed to enhance photo: ${photoPath}`, 'ENHANCEMENT_ERROR', {
        originalError: error,
      });
    }
  }

  /**
   * 批量增强照片
   */
  async enhanceBatch(
    photoPaths: string[],
    options: EnhancementOptions = {}
  ): Promise<{ successes: EnhancedPhoto[]; failures: { path: string; error: string }[] }> {
    logger.info(`Starting batch enhancement for ${photoPaths.length} photos`);

    const successes: EnhancedPhoto[] = [];
    const failures: { path: string; error: string }[] = [];

    for (const photoPath of photoPaths) {
      try {
        const result = await this.enhancePhoto(photoPath, options);
        successes.push(result);
      } catch (error) {
        const errorMessage = error instanceof AppError ? error.message : 'Unknown error';
        failures.push({ path: photoPath, error: errorMessage });
        logger.error(`Failed to enhance ${photoPath}:`, error);
      }
    }

    logger.info(
      `Batch enhancement completed: ${successes.length} succeeded, ${failures.length} failed`
    );

    return { successes, failures };
  }

  /**
   * 清理临时文件
   */
  clearTempFiles(): void {
    try {
      const dir = this.tempDir;
      if (dir && existsSync(dir)) {
        rmSync(dir, { recursive: true });
        this.tempDir = null;
        logger.info(`Cleaned up enhanced photos temp directory: ${dir}`);
      }
    } catch (error) {
      logger.warn(`Failed to clean up temp files:`, error);
    }
  }

  /**
   * 取得增強設定建議（基於品質評估）
   */
  getEnhancementSuggestion(
    qualityScore: number,
    recommendedQuality: number = 70
  ): EnhancementOptions {
    const suggestions: EnhancementOptions = {};

    if (qualityScore < recommendedQuality) {
      // 质量不足，需要增强
      const gap = recommendedQuality - qualityScore;

      if (gap > 30) {
        // 差很多，需要全面增强
        suggestions.brightness = 1.3;
        suggestions.contrast = 1.2;
        suggestions.sharpen = { amount: 0.5, radius: 1 };
      } else if (gap > 20) {
        // 中等差距
        suggestions.brightness = 1.2;
        suggestions.sharpen = { amount: 0.3, radius: 1 };
      } else {
        // 小差距
        suggestions.brightness = 1.1;
      }
    }

    return suggestions;
  }
}

// 延遲初始化全域實例，避免在 app ready 前呼叫 app.getPath()
let _photoEnhancer: PhotoEnhancer | null = null;
export function getPhotoEnhancer(): PhotoEnhancer {
  if (!_photoEnhancer) {
    _photoEnhancer = new PhotoEnhancer();
  }
  return _photoEnhancer;
}
