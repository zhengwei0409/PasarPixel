import sharp from "sharp";

const WATERMARK_TEXT = "PasarPixel";
const MAX_PREVIEW_WIDTH = 1200;

export async function watermarkImage(input: Buffer): Promise<Buffer> {
  const image = sharp(input).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? 800;
  const height = metadata.height ?? 800;

  const targetWidth = Math.min(width, MAX_PREVIEW_WIDTH);
  const scale = targetWidth / width;
  const targetHeight = Math.round(height * scale);

  const tileSize = Math.max(160, Math.round(targetWidth / 4));
  const fontSize = Math.max(18, Math.round(tileSize / 8));

  const svg = `
    <svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" x="0" y="0" width="${tileSize}" height="${tileSize}" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <text x="0" y="${tileSize / 2}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="white" fill-opacity="0.35" stroke="black" stroke-opacity="0.15" stroke-width="0.5">${WATERMARK_TEXT}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)" />
    </svg>
  `;

  return image
    .resize({ width: targetWidth })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 80 })
    .toBuffer();
}
