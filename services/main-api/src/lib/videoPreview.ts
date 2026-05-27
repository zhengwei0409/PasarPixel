import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const WATERMARK_TEXT = "PasarPixel";
const MAX_PREVIEW_SECONDS = 10;
const PREVIEW_RATIO = 0.3;

function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const duration = data.format.duration ?? 0;
      resolve(duration);
    });
  });
}

function runFfmpeg(inputPath: string, outputPath: string, durationSec: number): Promise<void> {
  const drawtext = [
    `text='${WATERMARK_TEXT}'`,
    "fontcolor=white@0.6",
    "fontsize=h/18",
    "box=1",
    "boxcolor=black@0.35",
    "boxborderw=8",
    "x=(w-text_w)/2",
    "y=h-(text_h*2)",
  ].join(":");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-t ${durationSec}`,
        "-vf",
        `scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)',drawtext=${drawtext}`,
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
  const outputPath = join(tmpdir(), `${id}-out.mp4`);

  await fs.writeFile(inputPath, input);
  try {
    const duration = await probeDuration(inputPath);
    const previewSec = Math.max(1, Math.min(duration * PREVIEW_RATIO, MAX_PREVIEW_SECONDS));
    await runFfmpeg(inputPath, outputPath, previewSec);
    return await fs.readFile(outputPath);
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}
