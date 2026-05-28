import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 600;
const SAMPLE_LINE_1 = "The quick brown fox jumps over the lazy dog";
const SAMPLE_LINE_2 = "AaBbCcDdEeFf 0123456789";
const SAMPLE_LINE_3 = "PasarPixel";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fontMimeType(fileType: string): string {
  if (fileType.includes("woff2")) return "font/woff2";
  if (fileType.includes("woff")) return "font/woff";
  if (fileType.includes("otf")) return "font/otf";
  return "font/ttf";
}

export async function generateFontPreview(
  input: Buffer,
  fileType: string,
): Promise<Buffer> {
  const fontBase64 = input.toString("base64");
  const mime = fontMimeType(fileType);
  const fontUri = `data:${mime};base64,${fontBase64}`;

  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style type="text/css">
          @font-face {
            font-family: "Sample";
            src: url("${fontUri}");
          }
          text { font-family: "Sample"; fill: #111; }
        </style>
      </defs>
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="60" y="140" font-size="72">${escapeXml(SAMPLE_LINE_3)}</text>
      <text x="60" y="280" font-size="48">${escapeXml(SAMPLE_LINE_1)}</text>
      <text x="60" y="400" font-size="48">${escapeXml(SAMPLE_LINE_2)}</text>
      <text x="60" y="520" font-size="36" fill="#666">abcdefghijklmnopqrstuvwxyz</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
