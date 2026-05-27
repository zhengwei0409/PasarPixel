import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const WATERMARK_TEXT = "PasarPixel";
const MAX_PREVIEW_SECONDS = 10;
const PREVIEW_RATIO = 0.3;
const MAX_LONG_EDGE = 720;

interface ProbeResult {
  duration: number;
  width: number;
  height: number;
}

function probeVideo(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const stream = data.streams.find((s) => s.codec_type === "video");
      resolve({
        duration: data.format.duration ?? 0,
        width: stream?.width ?? 1280,
        height: stream?.height ?? 720,
      });
    });
  });
}

function scaledSize(width: number, height: number): { w: number; h: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_LONG_EDGE) return { w: width, h: height };
  const scale = MAX_LONG_EDGE / longEdge;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return { w: w % 2 === 0 ? w : w - 1, h: h % 2 === 0 ? h : h - 1 };
}

async function buildWatermarkPng(width: number, height: number): Promise<Buffer> {
  const fontSize = Math.max(18, Math.round(width / 28));
  const stepX = Math.round(fontSize * 10);
  const stepY = Math.round(fontSize * 7);

  const texts: string[] = [];
  for (let y = -stepY; y < height + stepY; y += stepY) {
    for (let x = -stepX; x < width + stepX; x += stepX) {
      texts.push(
        `<text x="${x}" y="${y}" font-family="sans-serif" font-weight="bold" font-size="${fontSize}" fill="white" fill-opacity="0.35" stroke="black" stroke-opacity="0.2" stroke-width="1">${WATERMARK_TEXT}</text>`,
      );
    }
  }

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-30 ${width / 2} ${height / 2})">
        ${texts.join("\n")}
      </g>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function runFfmpeg(
  inputPath: string,
  watermarkPath: string,
  outputPath: string,
  durationSec: number,
  size: { w: number; h: number },
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .input(watermarkPath)
      .complexFilter([
        `[0:v]scale=${size.w}:${size.h}[scaled]`,
        `[scaled][1:v]overlay=0:0[outv]`,
      ])
      .outputOptions([
        `-t ${durationSec}`,
        "-map [outv]",
        "-map 0:a?",
        "-c:v libx264",
        "-preset fast",
        "-crf 28",
        "-c:a aac",
        "-b:a 96k",
        "-movflags +faststart",
      ])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

export async function generateVideoPreview(input: Buffer): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}-in.mp4`);
  const watermarkPath = join(tmpdir(), `${id}-wm.png`);
  const outputPath = join(tmpdir(), `${id}-out.mp4`);

  await fs.writeFile(inputPath, input);
  try {
    const { duration, width, height } = await probeVideo(inputPath);
    const size = scaledSize(width, height);
    const previewSec = Math.max(1, Math.min(duration * PREVIEW_RATIO, MAX_PREVIEW_SECONDS));
    const watermark = await buildWatermarkPng(size.w, size.h);
    await fs.writeFile(watermarkPath, watermark);
    await runFfmpeg(inputPath, watermarkPath, outputPath, previewSec, size);
    return await fs.readFile(outputPath);
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(watermarkPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}
