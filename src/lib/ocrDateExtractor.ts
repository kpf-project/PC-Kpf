/**
 * OCR Date Extractor
 * Extract manufacturing and expiry dates from product photos
 * Uses Tesseract.js for OCR
 *
 * Enhanced version with:
 * - Thai month names support (ม.ค., ก.พ., มี.ค., etc.)
 * - Buddhist calendar year conversion (พ.ศ. → ค.ศ.)
 * - Image preprocessing for better OCR accuracy
 * - More flexible date patterns
 * - Better debug logging
 */

import Tesseract from 'tesseract.js';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import buddhistEra from 'dayjs/plugin/buddhistEra';

dayjs.extend(customParseFormat);

const MFG_LABELS = [
  'mfg',
  'mfd',
  'prod',
  'manufactured',
  'manufacture',
  'ผลิต',
  'วันผลิต',
  'ผลิตวันที่',
];

const EXP_LABELS = [
  'exp',
  'expiry',
  'expiration',
  'best before',
  'use by',
  'bbe',
  'หมดอายุ',
  'วันหมดอายุ',
  'ถึงวันที่',
  'หมดอายุวันที่',
];

const THAI_MONTH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/(ม\.ค\.?|มกราคม)/gi, 'Jan'],
  [/(ก\.พ\.?|กุมภาพันธ์)/gi, 'Feb'],
  [/(มี\.ค\.?|มีนาคม)/gi, 'Mar'],
  [/(เม\.ย\.?|เมษายน)/gi, 'Apr'],
  [/(พ\.ค\.?|พฤษภาคม)/gi, 'May'],
  [/(มิ\.ย\.?|มิถุนายน)/gi, 'Jun'],
  [/(ก\.ค\.?|กรกฎาคม)/gi, 'Jul'],
  [/(ส\.ค\.?|สิงหาคม)/gi, 'Aug'],
  [/(ก\.ย\.?|กันยายน)/gi, 'Sep'],
  [/(ต\.ค\.?|ตุลาคม)/gi, 'Oct'],
  [/(พ\.ย\.?|พฤศจิกายน)/gi, 'Nov'],
  [/(ธ\.ค\.?|ธันวาคม)/gi, 'Dec'],
];

const DATE_LIKE_PATTERNS: RegExp[] = [
  /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
  /(\d{4})-(\d{2})-(\d{2})/,
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})/i,
  /(\d{2,4})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
  /(\d{6,8})/,
];

function convertThaiDigits(value: string): string {
  return value.replace(/[\u0E50-\u0E59]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0x0e50 + 0x30)
  );
}

function replaceThaiMonths(value: string): string {
  return THAI_MONTH_REPLACEMENTS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    value
  );
}

function normalizeDateTokens(value: string): string {
  let working = value;
  working = convertThaiDigits(working);
  working = replaceThaiMonths(working);
  working = working.replace(/พ\.?ศ\.?/gi, '');
  working = working.replace(/[^0-9a-zA-Z\/\-\.\s]/g, ' ');
  return working.replace(/\s+/g, ' ').trim();
}

function isDateLikeText(value: string): boolean {
  const normalized = normalizeDateTokens(value);
  return DATE_LIKE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getLabelType(value: string): 'mfg' | 'exp' | null {
  const normalized = value.toLowerCase();
  if (MFG_LABELS.some((label) => normalized.includes(label))) {
    return 'mfg';
  }
  if (EXP_LABELS.some((label) => normalized.includes(label))) {
    return 'exp';
  }
  return null;
}

dayjs.extend(buddhistEra);

// ============================================================================
// Types
// ============================================================================

export interface OcrResult {
  success: boolean;
  mfgDate: string | null;        // ISO format: YYYY-MM-DD
  expDate: string | null;         // ISO format: YYYY-MM-DD
  mfgConfidence: number;          // 0-100
  expConfidence: number;          // 0-100
  mfgRawText: string;             // Raw text found
  expRawText: string;             // Raw text found
  fullText: string;               // Complete OCR text
  error?: string;
}

export interface ProgressCallback {
  (progress: number): void;
}

// ============================================================================
// Image Preprocessing
// ============================================================================

/**
 * Preprocess image for better OCR accuracy
 * - Convert to grayscale
 * - Enhance contrast
 * - Resize if too large
 */
async function preprocessImage(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Resize if image is too large (max 1920px width)
      let width = img.width;
      let height = img.height;
      const maxWidth = 1920;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to grayscale and enhance contrast
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale using luminosity method
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Enhance contrast (simple threshold)
        const enhanced = gray < 128 ? Math.max(0, gray - 20) : Math.min(255, gray + 20);

        data[i] = enhanced;     // R
        data[i + 1] = enhanced; // G
        data[i + 2] = enhanced; // B
      }

      ctx.putImageData(imageData, 0, 0);

      // Convert back to data URL
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageDataUrl;
  });
}

// ============================================================================
// Main OCR Function
// ============================================================================

/**
 * Extract dates from image using Tesseract.js OCR
 */
export async function extractDatesFromImage(
  imageDataUrl: string,
  onProgress?: ProgressCallback
): Promise<OcrResult> {
  try {
    // Preprocess image for better OCR
    const preprocessedImage = await preprocessImage(imageDataUrl);

    // Run OCR with optimized settings
    const { data } = await Tesseract.recognize(
      preprocessedImage,
      'eng+tha', // Support English and Thai
      {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
        },
      }
    );

    const fullText = data.text;
    // Parse dates from text
    const result = parseDatesFromText(fullText);

    return {
      success: !!(result.mfgDate || result.expDate),
      mfgDate: result.mfgDate,
      expDate: result.expDate,
      mfgConfidence: result.mfgConfidence,
      expConfidence: result.expConfidence,
      mfgRawText: result.mfgRaw,
      expRawText: result.expRaw,
      fullText: fullText,
    };
  } catch (error) {
    console.error('[OCR] Error:', error);
    return {
      success: false,
      mfgDate: null,
      expDate: null,
      mfgConfidence: 0,
      expConfidence: 0,
      mfgRawText: '',
      expRawText: '',
      fullText: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Date Parsing Logic
// ============================================================================

interface ParseResult {
  mfgDate: string | null;
  expDate: string | null;
  mfgConfidence: number;
  expConfidence: number;
  mfgRaw: string;
  expRaw: string;
}

/**
 * Parse MFG and EXP dates from OCR text
 */
function parseDatesFromText(text: string): ParseResult {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let mfgDate: string | null = null;
  let expDate: string | null = null;
  let mfgRaw = '';
  let expRaw = '';
  let mfgConfidence = 0;
  let expConfidence = 0;

  // Try to find MFG and EXP dates with labels
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const detectedLabel = getLabelType(lineLower);

    if (!mfgDate && detectedLabel === 'mfg') {
      const dateMatch = extractDateFromLine(line);
      if (dateMatch) {
        mfgRaw = dateMatch.raw;
        mfgDate = parseDate(dateMatch.raw);
        mfgConfidence = dateMatch.hasLabel ? 95 : 80;
      }
    }

    if (!expDate && detectedLabel === 'exp') {
      const dateMatch = extractDateFromLine(line);
      if (dateMatch) {
        expRaw = dateMatch.raw;
        expDate = parseDate(dateMatch.raw);
        expConfidence = dateMatch.hasLabel ? 95 : 80;
      }
    }
  }

  // Fallback: If no labels found, try to extract any two dates
  if (!mfgDate && !expDate) {
    const allDates: string[] = [];
    for (const line of lines) {
      const dateMatch = extractDateFromLine(line);
      if (dateMatch) {
        allDates.push(dateMatch.raw);
      }
    }

    // If we found at least 2 dates, assume first is MFG, second is EXP
    if (allDates.length >= 2) {
      mfgRaw = allDates[0];
      expRaw = allDates[1];
      mfgDate = parseDate(allDates[0]);
      expDate = parseDate(allDates[1]);
      mfgConfidence = 70; // Lower confidence without labels
      expConfidence = 70;
    } else if (allDates.length === 1) {
      // Only one date found, assume it's expiry (more important)
      expRaw = allDates[0];
      expDate = parseDate(allDates[0]);
      expConfidence = 70;
    }
  }

  // Validate: EXP should be after MFG
  if (mfgDate && expDate) {
    const mfgDay = dayjs(mfgDate);
    const expDay = dayjs(expDate);
    if (expDay.isBefore(mfgDay)) {
      // Swap if wrong order
      [mfgDate, expDate] = [expDate, mfgDate];
      [mfgRaw, expRaw] = [expRaw, mfgRaw];
      [mfgConfidence, expConfidence] = [expConfidence, mfgConfidence];
    }
  }

  return {
    mfgDate,
    expDate,
    mfgConfidence,
    expConfidence,
    mfgRaw,
    expRaw,
  };
}

// ============================================================================
// Thai Month Names
// ============================================================================

const THAI_MONTH_MAP: Record<string, number> = {
  'ม.ค.': 1, 'มค': 1, 'มกรา': 1, 'มกราคม': 1,
  'ก.พ.': 2, 'กพ': 2, 'กุมภา': 2, 'กุมภาพันธ์': 2,
  'มี.ค.': 3, 'มีค': 3, 'มีนา': 3, 'มีนาคม': 3,
  'เม.ย.': 4, 'เมย': 4, 'เมษา': 4, 'เมษายน': 4,
  'พ.ค.': 5, 'พค': 5, 'พฤษภา': 5, 'พฤษภาคม': 5,
  'มิ.ย.': 6, 'มิย': 6, 'มิถุนา': 6, 'มิถุนายน': 6,
  'ก.ค.': 7, 'กค': 7, 'กรกฎา': 7, 'กรกฎาคม': 7,
  'ส.ค.': 8, 'สค': 8, 'สิงหา': 8, 'สิงหาคม': 8,
  'ก.ย.': 9, 'กย': 9, 'กันยา': 9, 'กันยายน': 9,
  'ต.ค.': 10, 'ตค': 10, 'ตุลา': 10, 'ตุลาคม': 10,
  'พ.ย.': 11, 'พย': 11, 'พฤศจิกา': 11, 'พฤศจิกายน': 11,
  'ธ.ค.': 12, 'ธค': 12, 'ธันวา': 12, 'ธันวาคม': 12,
};

const ENGLISH_MONTH_MAP: Record<string, number> = {
  'jan': 1, 'january': 1,
  'feb': 2, 'february': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4,
  'may': 5,
  'jun': 6, 'june': 6,
  'jul': 7, 'july': 7,
  'aug': 8, 'august': 8,
  'sep': 9, 'september': 9,
  'oct': 10, 'october': 10,
  'nov': 11, 'november': 11,
  'dec': 12, 'december': 12,
};

/**
 * Convert Buddhist year (พ.ศ.) to Christian year (ค.ศ.)
 * Example: 2568 → 2025 (subtract 543)
 */
function convertBuddhistYear(year: number): number {
  // If year is > 2500, it's likely Buddhist year
  if (year > 2500 && year < 2700) {
    return year - 543;
  }
  return year;
}

// ============================================================================
// Date Pattern Matching
// ============================================================================

interface DateMatch {
  raw: string;
  hasLabel: boolean;
}

export interface DetectedDateRegion {
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  text: string;
  label: string;
  type: 'mfg' | 'exp' | 'date';
  confidence: number;
}

export async function detectDateRegions(
  imageDataUrl: string,
  onProgress?: ProgressCallback
): Promise<DetectedDateRegion[]> {
  try {
    const { data } = await Tesseract.recognize(imageDataUrl, 'eng+tha', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: (m: any) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
      tessedit_pageseg_mode: 6,
      oem: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data as any).words ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((word: any) => {
        const text = (word.text || '').trim();
        if (!text || !word.bbox) return null;
        const labelType = getLabelType(text);
        const dateLike = isDateLikeText(text);
        if (!labelType && !dateLike) return null;

        const regionType = labelType ?? 'date';
        const label =
          regionType === 'mfg' ? 'MFG' : regionType === 'exp' ? 'EXP' : 'วันที่';

        return {
          bbox: {
            x0: word.bbox.x0 ?? 0,
            y0: word.bbox.y0 ?? 0,
            x1: word.bbox.x1 ?? 0,
            y1: word.bbox.y1 ?? 0,
          },
          text,
          label,
          type: regionType,
          confidence: Math.round(word.confidence ?? 0),
        };
      })
      .filter((region: DetectedDateRegion | null): region is DetectedDateRegion => Boolean(region));
  } catch (error) {
    console.error('[OCR] Detection error:', error);
    return [];
  }
}

/**
 * Extract date from a single line of text
 */
function extractDateFromLine(line: string): DateMatch | null {
  // Common date patterns (expanded for Thai products)
  const patterns = [
    // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD MM YYYY
    /(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/,

    // DDMMYYYY, DDMMYY (compact format without separators)
    /(?<![\/\-\.\d])(\d{2})(\d{2})(\d{2,4})(?![\/\-\.\d])/,

    // Thai month name formats: 25 ม.ค. 68, 25 มค 68, 25 มกรา 2568
    /(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มค|กพ|มีค|เมย|พค|มิย|กค|สค|กย|ตค|พย|ธค|มกรา|กุมภา|มีนา|เมษา|พฤษภา|มิถุนา|กรกฎา|สิงหา|กันยา|ตุลา|พฤศจิกา|ธันวา)[,\s]*(\d{2,4})?/i,

    // English month name formats: 25 JAN 25, JAN 25 2025
    /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[,\s-]*(\d{1,2})[,\s-]*(\d{2,4})?/i,
    /(\d{1,2})[,\s-]*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[,\s-]*(\d{2,4})?/i,

    // YYYY-MM-DD (ISO format)
    /(\d{4})-(\d{2})-(\d{2})/,

    // YYYY/MM/DD or YYYY.MM.DD
    /(\d{4})[\/\.](\d{2})[\/\.](\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      console.log('[OCR] Pattern matched:', { pattern: pattern.toString(), match: match[0], line });
      return {
        raw: match[0],
        hasLabel: hasDateLabel(line),
      };
    }
  }

  return null;
}

/**
 * Check if line contains date label keywords
 */
function hasDateLabel(line: string): boolean {
  return getLabelType(line) !== null;
}

// ============================================================================
// Date Parsing & Normalization
// ============================================================================

/**
 * Parse date string to ISO format (YYYY-MM-DD)
 * Handles Thai formats, Buddhist calendar, and various separators
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Check for Thai month names first
  const thaiMonthPattern = /(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มค|กพ|มีค|เมย|พค|มิย|กค|สค|กย|ตค|พย|ธค|มกรา|กุมภา|มีนา|เมษา|พฤษภา|มิถุนา|กรกฎา|สิงหา|กันยา|ตุลา|พฤศจิกา|ธันวา)/i;
  const thaiMonthMatch = dateStr.match(thaiMonthPattern);

  if (thaiMonthMatch) {
    // Extract day, month, year from Thai format
    const dayMatch = dateStr.match(/(\d{1,2})/);
    const yearMatch = dateStr.match(/(\d{2,4})$/);

    if (dayMatch && yearMatch) {
      const day = parseInt(dayMatch[1]);
      const monthName = thaiMonthMatch[1].toLowerCase();
      const monthNum = THAI_MONTH_MAP[monthName];
      let year = parseInt(yearMatch[1]);

      // Handle 2-digit year
      if (year < 100) {
        // Assume 68 = 2568 BE = 2025 CE
        year = year > 50 ? 2500 + year : 2600 + year;
      }

      // Convert Buddhist year to Christian year
      year = convertBuddhistYear(year);

      if (monthNum && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const parsed = dayjs(dateStr);
        if (parsed.isValid()) {
        return parsed.format('YYYY-MM-DD');
      }
    }
  }
  }

  // Check for English month names
  const engMonthPattern = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  const engMonthMatch = dateStr.match(engMonthPattern);

  if (engMonthMatch) {
    const dayMatch = dateStr.match(/(\d{1,2})/);
    const yearMatch = dateStr.match(/(\d{2,4})$/);

    if (dayMatch && yearMatch) {
      const day = parseInt(dayMatch[1]);
      const monthName = engMonthMatch[1].toLowerCase();
      const monthNum = ENGLISH_MONTH_MAP[monthName];
      let year = parseInt(yearMatch[1]);

      // Handle 2-digit year
      if (year < 100) {
        year = year > 50 ? 1900 + year : 2000 + year;
      }

      if (monthNum && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const parsed = dayjs(dateStr);
        if (parsed.isValid()) {
        return parsed.format('YYYY-MM-DD');
      }
      }
    }
  }

  // Try numeric formats
  const formats = [
    'DD/MM/YYYY',
    'DD-MM-YYYY',
    'DD.MM.YYYY',
    'DD MM YYYY',
    'DD/MM/YY',
    'DD-MM-YY',
    'DD.MM.YY',
    'DD MM YY',
    'DDMMYYYY',
    'DDMMYY',
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'YYYY.MM.DD',
  ];

  for (const format of formats) {
    let parsed = dayjs(dateStr, format, true);

    if (parsed.isValid()) {
      let year = parsed.year();

      // Handle 2-digit year with Buddhist calendar check
      if (format.includes('YY') && !format.includes('YYYY')) {
        const yearMatch = dateStr.match(/(\d{2})$/);
        if (yearMatch) {
          const twoDigitYear = parseInt(yearMatch[1]);
          // If year is 60-99, it's likely Buddhist year (2560-2599)
          if (twoDigitYear >= 60) {
            year = 2500 + twoDigitYear;
            year = convertBuddhistYear(year);
            parsed = parsed.year(year);
          }
        }
      } else {
        // Check if 4-digit year is Buddhist year
        year = convertBuddhistYear(year);
        parsed = parsed.year(year);
      }

      const currentYear = dayjs().year();
      // Date should be between 2020 and 10 years from now
      if (year >= 2020 && year <= currentYear + 10) {
        return parsed.format('YYYY-MM-DD');
      }
    }
  }

  return null;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate if date is in reasonable range
 */
export function isDateReasonable(dateStr: string | null): boolean {
  if (!dateStr) return false;

  const date = dayjs(dateStr);
  if (!date.isValid()) return false;

  const year = date.year();
  const currentYear = dayjs().year();

  // Date should be between 2020 and 10 years from now
  return year >= 2020 && year <= currentYear + 10;
}

/**
 * Calculate days until expiry
 */
export function daysUntilExpiry(expDate: string | null): number | null {
  if (!expDate) return null;

  const exp = dayjs(expDate);
  const now = dayjs();

  return exp.diff(now, 'day');
}

/**
 * Get expiry status
 */
export function getExpiryStatus(expDate: string | null): 'ok' | 'warning' | 'critical' | 'expired' | 'unknown' {
  if (!expDate) return 'unknown';

  const days = daysUntilExpiry(expDate);
  if (days === null) return 'unknown';

  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'ok';
}
