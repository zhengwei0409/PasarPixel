import sharp from "sharp";
import fontkit, { Font } from "fontkit";

const WIDTH = 1200;
const HEIGHT = 600;

interface SampleLine {
  text: string;
  fontSize: number;
  y: number;
  fill: string;
}

const LINES: SampleLine[] = [
  { text: "PasarPixel", fontSize: 80, y: 130, fill: "#111" },
  { text: "The quick brown fox jumps over the lazy dog", fontSize: 44, y: 250, fill: "#111" },
  { text: "AaBbCcDdEeFf 0123456789", fontSize: 44, y: 370, fill: "#111" },
  { text: "abcdefghijklmnopqrstuvwxyz", fontSize: 36, y: 490, fill: "#666" },
];

function renderLine(font: Font, line: SampleLine, startX: number): string {
  const run = font.layout(line.text);
  const scale = line.fontSize / font.unitsPerEm;

  let x = startX;
  const paths: string[] = [];

  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i];
    const position = run.positions[i];

    const tx = x + position.xOffset * scale;
    const ty = line.y + position.yOffset * scale;

    const d = glyph.path
      .scale(scale, -scale)
      .translate(tx, ty)
      .toSVG();

    if (d) {
      paths.push(`<path d="${d}" fill="${line.fill}"/>`);
    }

    x += position.xAdvance * scale;
  }

  return paths.join("\n");
}

export async function generateFontPreview(input: Buffer): Promise<Buffer> {
  const font = fontkit.create(input) as Font;

  const paths = LINES.map((line) => renderLine(font, line, 60)).join("\n");

  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      ${paths}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
