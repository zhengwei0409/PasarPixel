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

  const fontSize = Math.max(24, Math.round(targetWidth / 22));
  const stepX = Math.round(fontSize * 12);
  const stepY = Math.round(fontSize * 8);

  const texts: string[] = [];
  for (let y = -stepY; y < targetHeight + stepY; y += stepY) {
    for (let x = -stepX; x < targetWidth + stepX; x += stepX) {
      texts.push(
        `<text x="${x}" y="${y}" font-family="sans-serif" font-weight="bold" font-size="${fontSize}" fill="white" fill-opacity="0.45" stroke="black" stroke-opacity="0.25" stroke-width="1">${WATERMARK_TEXT}</text>`,
      );
    }
  }

  const svg = `
    <svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-30 ${targetWidth / 2} ${targetHeight / 2})">
        ${texts.join("\n")}
      </g>
    </svg>
  `;

  return image
    .resize({ width: targetWidth })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 80 })
    .toBuffer();
}
