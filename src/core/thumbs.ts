import { join } from 'path';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { getThumbsDir } from './db';
import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';

export async function ensureThumbnailFor(filePath: string): Promise<string> {
  const thumbsDir = getThumbsDir();
  const hash = createHash('md5').update(filePath).digest('hex');
  const out = join(thumbsDir, `${hash}.jpg`);
  
  if (!existsSync(out)) {
    try {
      logger.debug(`Generating thumbnail for: ${filePath}`);
      
      // Handle HEIC/HEIF files by converting them first
      let sharpInstance = sharp(filePath);
      const isHeic = filePath.toLowerCase().endsWith('.heic') || filePath.toLowerCase().endsWith('.heif');
      
      if (isHeic) {
        // For HEIC files, we might need additional processing
        // Sharp has some HEIC support but it's not always complete
        try {
          sharpInstance = sharp(filePath, { sequentialRead: true });
        } catch (heicError) {
          logger.warn(`Failed to process HEIC file ${filePath}:`, heicError);
          throw new AppError(
            `HEIC format not fully supported: ${filePath}`,
            'HEIC_NOT_SUPPORTED',
            { originalError: heicError }
          );
        }
      }
      
      await sharpInstance
        .rotate()
        .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70, progressive: true })
        .toFile(out);
        
      logger.debug(`Thumbnail generated successfully: ${out}`);
    } catch (error) {
      logger.error(`Failed to generate thumbnail for ${filePath}:`, error);
      throw new AppError(
        `Failed to generate thumbnail for ${filePath}`,
        'THUMBNAIL_ERROR',
        { originalError: error }
      );
    }
  }
  
  return out;
}


