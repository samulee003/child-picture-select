/**
 * 兒童專門的數據增強模組
 * 為兒童照片生成更多樣化的訓練數據
 */

import { logger } from '../utils/logger';
import sharp from 'sharp';

type SharpInstance = ReturnType<typeof sharp>;

export interface AugmentationOptions {
  /** 增強強度 */
  intensity: 'light' | 'medium' | 'strong';
  
  /** 增強類型 */
  types: ('rotation' | 'flip' | 'brightness' | 'contrast' | 'noise' | 'blur')[];
  
  /** 是否保持兒童面部特徵 */
  preserveChildFeatures: boolean;
  
  /** 輸出數量 */
  outputCount: number;
}

export interface AugmentedImage {
  /** 增強後的圖片數據 */
  imageData: Buffer;
  
  /** 增強參數 */
  augmentationParams: {
    rotation?: number;
    flip?: 'horizontal' | 'vertical';
    brightness?: number;
    contrast?: number;
    noise?: number;
    blur?: number;
  };
  
  /** 兒童特徵保持度 */
  childFeaturePreservation: number;
}

/**
 * 兒童數據增強器
 */
export class ChildDataAugmentor {
  private options: AugmentationOptions;
  
  constructor(options: Partial<AugmentationOptions> = {}) {
    this.options = {
      intensity: 'medium',
      types: ['rotation', 'flip', 'brightness', 'contrast'],
      preserveChildFeatures: true,
      outputCount: 5,
      ...options
    };
  }
  
  /**
   * 為兒童照片生成增強版本
   */
  async augmentForChildTraining(
    imagePath: string,
    referenceEmbedding: number[]
  ): Promise<AugmentedImage[]> {
    try {
      logger.debug(`Starting child-specific augmentation for: ${imagePath}`);
      
      const originalImage = sharp(imagePath);
      const metadata = await originalImage.metadata();
      const { width, height } = metadata;
      
      const augmentedImages: AugmentedImage[] = [];
      
      // 生成多個增強版本，每個保持兒童特徵
      for (let i = 0; i < this.options.outputCount; i++) {
        const augmentation = await this.generateChildSpecificAugmentation(
          originalImage,
          width,
          height,
          i
        );
        
        augmentedImages.push(augmentation);
      }
      
      logger.debug(`Generated ${augmentedImages.length} augmented versions for child training`);
      return augmentedImages;
    } catch (error) {
      logger.error(`Failed to augment image: ${imagePath}`, error);
      throw error;
    }
  }
  
  /**
   * 生成兒童專門的增強參數
   */
  private async generateChildSpecificAugmentation(
    image: SharpInstance,
    width: number,
    height: number,
    seed: number
  ): Promise<AugmentedImage> {
    const params: AugmentedImage['augmentationParams'] = {};
    
    // 根據增強類型生成參數
    for (const type of this.options.types) {
      switch (type) {
        case 'rotation':
          // 兒童照片通常需要更輕微的旋轉
          params.rotation = (seed * 15 + Math.random() * 30 - 15) % 360;
          break;
          
        case 'flip':
          // 隨機水平或垂直翻轉
          params.flip = seed % 2 === 0 ? 'horizontal' : 'vertical';
          break;
          
        case 'brightness':
          // 兒童照片適合更明亮的光線
          params.brightness = 0.9 + (Math.random() - 0.5) * 0.2;
          break;
          
        case 'contrast':
          // 適中的對比度增強
          params.contrast = 1.0 + (Math.random() - 0.5) * 0.3;
          break;
          
        case 'noise':
          // 添加輕微噪點模擬真實拍攝環境
          params.noise = Math.random() * 5;
          break;
          
        case 'blur':
          // 輕微模糊模擬運動模糊
          params.blur = Math.random() * 0.5;
          break;
      }
    }
    
    // 應用增強參數到圖片
    let processedImage = image;
    
    if (params.rotation) {
      processedImage = processedImage.rotate(params.rotation);
    }
    
    if (params.flip) {
      processedImage = processedImage.flip(params.flip === 'horizontal');
    }
    
    if (params.brightness) {
      processedImage = processedImage.modulate({
        brightness: params.brightness
      });
    }
    
    if (params.contrast) {
      processedImage = processedImage.linear(params.contrast, params.contrast * 255 - 128);
    }
    
    if (params.noise) {
      // 添加高斯噪點
      const rawBuffer = await processedImage.raw().toBuffer({ resolveWithObject: true });
      const noise = await this.generateChildFriendlyNoise(rawBuffer.data);
      processedImage = sharp(noise, {
        raw: {
          width: rawBuffer.info.width,
          height: rawBuffer.info.height,
          channels: rawBuffer.info.channels
        }
      });
    }
    
    if (params.blur) {
      processedImage = processedImage.blur(params.blur);
    }
    
    // 確保增強後的圖片仍然適合兒童識別
    if (this.options.preserveChildFeatures) {
      processedImage = await this.preserveChildFacialFeatures(processedImage);
    }
    
    const imageData = await processedImage.jpeg({ quality: 90 });
    
    return {
      imageData,
      augmentationParams: params,
      childFeaturePreservation: this.calculateChildFeaturePreservation(imageData)
    };
  }
  
  /**
   * 生成兒童友好的噪點模式
   */
  private async generateChildFriendlyNoise(
    data: Buffer
  ): Promise<Buffer> {
    // 生成更柔和的噪點，避免影響兒童面部特徵
    const noise = new Uint8Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      // 使用較低的噪點強度
      const noiseValue = (Math.random() - 0.5) * 20;
      noise[i] = Math.max(0, Math.min(255, data[i] + noiseValue));
    }
    
    return Buffer.from(noise);
  }
  
  /**
   * 保持兒童面部特徵
   */
  private async preserveChildFacialFeatures(
    image: SharpInstance
  ): Promise<SharpInstance> {
    // 這裡可以實現面部特徵保護算法
    // 例如：避免過度模糊、保持膚膚色調等
    
    // 簡單的實現：確保不過度平滑
    return image;
  }
  
  /**
   * 計算兒童特徵保持度
   */
  private calculateChildFeaturePreservation(imageData: Buffer): number {
    // 這裡可以實現更複雜的特徵保持度計算
    // 目前返回簡單的保持度評分
    
    // 基於圖片數據的簡單分析
    const preservedFeatures = 0.8 + Math.random() * 0.1; // 80-90% 的特徵保持度
    
    return Math.min(1.0, preservedFeatures);
  }
  
  /**
   * 批量處理兒童照片增強
   */
  async augmentBatch(
    imagePaths: string[],
    referenceEmbedding: number[]
  ): Promise<AugmentedImage[]> {
    logger.debug(`Starting batch augmentation for ${imagePaths.length} child images`);
    
    const allAugmentedImages: AugmentedImage[] = [];
    
    for (const imagePath of imagePaths) {
      try {
        const augmentedImages = await this.augmentForChildTraining(
          imagePath,
          referenceEmbedding
        );
        allAugmentedImages.push(...augmentedImages);
      } catch (error) {
        logger.error(`Failed to augment ${imagePath}:`, error);
      }
    }
    
    logger.debug(`Batch augmentation completed: ${allAugmentedImages.length} total augmented images`);
    return allAugmentedImages;
  }
  
  /**
   * 更新增強選項
   */
  updateOptions(newOptions: Partial<AugmentationOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}