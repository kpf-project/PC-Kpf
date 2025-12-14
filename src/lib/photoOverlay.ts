/**
 * Photo Overlay Utilities
 *
 * Adds timestamp and location overlays to photos
 * Used for auto-generated attendance records
 */

interface OverlayOptions {
  timestamp: string;      // e.g., "12:30 น."
  location: string;       // e.g., "ออกจาก ร้าน A"
  fontSize?: number;      // Default: 32 for timestamp, 24 for location
  padding?: number;       // Default: 20
  overlayHeight?: number; // Default: 80
}

/**
 * Add timestamp overlay to photo
 * @param photoBase64 - Base64 encoded photo
 * @param options - Overlay options
 * @returns Promise<string> - Base64 encoded photo with overlay
 */
export async function addTimestampOverlay(
  photoBase64: string,
  options: OverlayOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Cannot get canvas context');
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Set defaults
        const overlayHeight = options.overlayHeight ?? 80;
        const padding = options.padding ?? 20;
        const timestampFontSize = options.fontSize ?? 32;
        const locationFontSize = Math.floor(timestampFontSize * 0.75);

        // Add semi-transparent gradient overlay at bottom
        const gradient = ctx.createLinearGradient(
          0,
          canvas.height - overlayHeight,
          0,
          canvas.height
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');

        ctx.fillStyle = gradient;
        ctx.fillRect(
          0,
          canvas.height - overlayHeight,
          canvas.width,
          overlayHeight
        );

        // Add timestamp text (larger, bold)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${timestampFontSize}px "Sarabun", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Add text shadow for better readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillText(
          options.timestamp,
          padding,
          canvas.height - overlayHeight + padding
        );

        // Add location text (smaller)
        ctx.font = `${locationFontSize}px "Sarabun", sans-serif`;
        ctx.fillText(
          options.location,
          padding,
          canvas.height - overlayHeight + padding + timestampFontSize + 8
        );

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Convert back to base64
        const newBase64 = canvas.toDataURL('image/jpeg', 0.92);
        resolve(newBase64);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = photoBase64;
  });
}

/**
 * Capture photo from camera with overlay
 * @param videoElement - Video element from camera stream
 * @param options - Overlay options
 * @returns Promise<string> - Base64 encoded photo with overlay
 */
export async function capturePhotoWithOverlay(
  videoElement: HTMLVideoElement,
  options: OverlayOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      if (!videoElement.videoWidth || !videoElement.videoHeight) {
        throw new Error('Video not ready');
      }

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Cannot get canvas context');
      }

      // Draw video frame
      ctx.drawImage(videoElement, 0, 0);

      // Set defaults
      const overlayHeight = options.overlayHeight ?? 100;
      const padding = options.padding ?? 30;
      const timestampFontSize = options.fontSize ?? 48;
      const locationFontSize = Math.floor(timestampFontSize * 0.75);

      // Add gradient overlay
      const gradient = ctx.createLinearGradient(
        0,
        canvas.height - overlayHeight,
        0,
        canvas.height
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');

      ctx.fillStyle = gradient;
      ctx.fillRect(
        0,
        canvas.height - overlayHeight,
        canvas.width,
        overlayHeight
      );

      // Add text shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Add timestamp
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${timestampFontSize}px "Sarabun", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      ctx.fillText(
        options.timestamp,
        padding,
        canvas.height - overlayHeight + padding
      );

      // Add location
      ctx.font = `${locationFontSize}px "Sarabun", sans-serif`;
      ctx.fillText(
        options.location,
        padding,
        canvas.height - overlayHeight + padding + timestampFontSize + 10
      );

      // Convert to base64
      const photo = canvas.toDataURL('image/jpeg', 0.92);
      resolve(photo);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Calculate distance between two GPS coordinates (Haversine formula)
 * @param lat1 - Latitude 1
 * @param lon1 - Longitude 1
 * @param lat2 - Latitude 2
 * @param lon2 - Longitude 2
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert file to base64
 * @param file - File object
 * @returns Promise<string> - Base64 encoded string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}
