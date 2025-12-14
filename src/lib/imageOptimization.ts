/**
 * Image Optimization Utilities
 *
 * Provides server-side image compression and resizing for uploaded photos.
 * Reduces storage costs and improves load performance.
 *
 * @module imageOptimization
 */

import { createCanvas, loadImage } from 'canvas';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 (JPEG quality)
  maintainAspectRatio?: boolean;
}

export interface OptimizedImageResult {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
}

/**
 * Calculates new dimensions maintaining aspect ratio
 */
export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): ImageDimensions {
  let width = originalWidth;
  let height = originalHeight;

  // Calculate scaling factors
  const widthScale = maxWidth / width;
  const heightScale = maxHeight / height;
  const scale = Math.min(widthScale, heightScale, 1); // Never upscale

  width = Math.round(width * scale);
  height = Math.round(height * scale);

  return { width, height };
}

/**
 * Resizes and compresses an image buffer
 *
 * @param imageBuffer - Original image buffer
 * @param options - Resize and compression options
 * @returns Optimized image buffer with metadata
 */
export async function optimizeImage(
  imageBuffer: Buffer,
  options: ResizeOptions = {}
): Promise<OptimizedImageResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    maintainAspectRatio = true,
  } = options;

  // Load image
  const img = await loadImage(imageBuffer);
  const originalWidth = img.width;
  const originalHeight = img.height;
  const originalSize = imageBuffer.length;

  // Calculate new dimensions
  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  if (maintainAspectRatio) {
    const dims = calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight);
    targetWidth = dims.width;
    targetHeight = dims.height;
  } else {
    targetWidth = Math.min(originalWidth, maxWidth);
    targetHeight = Math.min(originalHeight, maxHeight);
  }

  // Create canvas and draw resized image
  const canvas = createCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');

  // Use better image smoothing
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) {
    // Type assertion for Canvas API property not in Node.js types
    (ctx as unknown as { imageSmoothingQuality: string }).imageSmoothingQuality = 'high';
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Convert to buffer with compression
  const optimizedBuffer = canvas.toBuffer('image/jpeg', { quality });
  const optimizedSize = optimizedBuffer.length;

  return {
    buffer: optimizedBuffer,
    mimeType: 'image/jpeg',
    width: targetWidth,
    height: targetHeight,
    originalSize,
    optimizedSize,
    compressionRatio: optimizedSize / originalSize,
  };
}

/**
 * Creates multiple resized versions of an image (thumbnail, medium, full)
 *
 * @param imageBuffer - Original image buffer
 * @returns Object with thumbnail, medium, and full-size buffers
 */
export async function createMultiResolution(imageBuffer: Buffer): Promise<{
  thumbnail: OptimizedImageResult;
  medium: OptimizedImageResult;
  full: OptimizedImageResult;
}> {
  const [thumbnail, medium, full] = await Promise.all([
    optimizeImage(imageBuffer, {
      maxWidth: 150,
      maxHeight: 150,
      quality: 0.8,
    }),
    optimizeImage(imageBuffer, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.85,
    }),
    optimizeImage(imageBuffer, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.9,
    }),
  ]);

  return { thumbnail, medium, full };
}

/**
 * Converts base64 data URL to buffer
 *
 * @param dataUrl - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @returns Image buffer
 */
export function dataUrlToBuffer(dataUrl: string): Buffer {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }

  const base64Data = matches[2];
  return Buffer.from(base64Data, 'base64');
}

/**
 * Converts buffer to base64 data URL
 *
 * @param buffer - Image buffer
 * @param mimeType - MIME type (e.g., "image/jpeg")
 * @returns Base64 data URL
 */
export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Optimizes a data URL image and returns optimized data URL
 *
 * Convenience function that combines dataUrlToBuffer, optimizeImage, and bufferToDataUrl
 *
 * @param dataUrl - Original base64 data URL
 * @param options - Resize and compression options
 * @returns Optimized data URL
 */
export async function optimizeDataUrl(
  dataUrl: string,
  options: ResizeOptions = {}
): Promise<{
  dataUrl: string;
  metadata: OptimizedImageResult;
}> {
  const buffer = dataUrlToBuffer(dataUrl);
  const result = await optimizeImage(buffer, options);
  const optimizedDataUrl = bufferToDataUrl(result.buffer, result.mimeType);

  return {
    dataUrl: optimizedDataUrl,
    metadata: result,
  };
}

/**
 * Estimates storage savings from optimization
 *
 * @param originalSize - Original file size in bytes
 * @param optimizedSize - Optimized file size in bytes
 * @returns Object with savings information
 */
export function calculateStorageSavings(
  originalSize: number,
  optimizedSize: number
): {
  savedBytes: number;
  savedMB: number;
  savingsPercent: number;
} {
  const savedBytes = originalSize - optimizedSize;
  const savedMB = savedBytes / (1024 * 1024);
  const savingsPercent = (savedBytes / originalSize) * 100;

  return {
    savedBytes,
    savedMB: Number(savedMB.toFixed(2)),
    savingsPercent: Number(savingsPercent.toFixed(1)),
  };
}

/**
 * USAGE NOTES:
 *
 * This module requires the 'canvas' package to be installed:
 * npm install canvas
 *
 * On some systems, canvas requires native dependencies:
 * - Ubuntu/Debian: sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
 * - macOS: brew install pkg-config cairo pango libpng jpeg giflib librsvg
 * - Windows: See https://github.com/Automattic/node-canvas/wiki/Installation:-Windows
 *
 * Alternative: Use sharp library instead (faster, better quality):
 * npm install sharp
 *
 * For production deployment on Netlify/Vercel, consider:
 * 1. Using sharp library (better performance)
 * 2. Pre-compressing images on client-side before upload
 * 3. Using CDN with automatic image optimization (Cloudflare Images, Cloudinary)
 */
