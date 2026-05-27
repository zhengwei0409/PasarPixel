import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const MAX_PREVIEW_SECONDS = 15;
const PREVIEW_RATIO = 0.3;

function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration ?? 0);
    });
  });
}

function runFfmpeg(
  inputPath: string,
  outputPath: string,
  durationSec: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-t ${durationSec}`,
        "-vn",
        "-c:a aac",
        "-b:a 128k",
        "-movflags +faststart",
      ])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

export async function generateAudioPreview(input: Buffer): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}-in.audio`);
  const outputPath = join(tmpdir(), `${id}-out.m4a`);

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
