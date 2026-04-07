import sharp from "sharp";

interface ProcessedImage {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

interface ProcessedResult {
  thumb: ProcessedImage;
  medium: ProcessedImage;
  full: ProcessedImage;
}

const SIZES = {
  thumb:  { width: 400,  quality: 80 },
  medium: { width: 1200, quality: 85 },
  full:   { width: 3000, quality: 90 },
} as const;

const MAX_DIMENSION = 6000;
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

/**
 * Validate image dimensions and size before processing.
 * Returns an error message string if invalid, or null if OK.
 */
export async function validateImage(buffer: Buffer): Promise<string | null> {
  if (buffer.length > MAX_FILE_SIZE) {
    return `File too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Maximum is 15 MB.`;
  }

  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width && metadata.width > MAX_DIMENSION) {
      return `Image width (${metadata.width}px) exceeds maximum of ${MAX_DIMENSION}px.`;
    }
    if (metadata.height && metadata.height > MAX_DIMENSION) {
      return `Image height (${metadata.height}px) exceeds maximum of ${MAX_DIMENSION}px.`;
    }
  } catch {
    return "Could not read image metadata. Ensure the file is a valid JPEG, PNG, or WebP.";
  }

  return null;
}

/**
 * Process an uploaded image into 3 WebP variants (thumb, medium, full).
 * Strips EXIF metadata for privacy.
 */
export async function processImage(
  buffer: Buffer,
  baseName: string,
): Promise<ProcessedResult> {
  const results = {} as ProcessedResult;

  for (const [key, config] of Object.entries(SIZES)) {
    const processed = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize({ width: config.width, withoutEnlargement: true })
      .webp({ quality: config.quality })
      .toBuffer();

    results[key as keyof ProcessedResult] = {
      buffer: processed,
      filename: `artworks/${baseName}_${key}.webp`,
      contentType: "image/webp",
    };
  }

  return results;
}
