import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export async function audioMetadata(input: Buffer): Promise<{ durationSeconds: number }> {
    const filePath = join(tmpdir(), `${randomUUID()}-metadata-audio`);
    await fs.writeFile(filePath, input);
    try {
        return await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (error, data) => {
                if (error) return reject(error);
                const stream = data.streams.find((item) => item.codec_type === "audio");
                if (!stream) return reject(new Error("Audio stream is unavailable"));
                const duration = Number(stream.duration ?? data.format.duration);
                if (!Number.isFinite(duration) || duration < 0) return reject(new Error("Audio duration is unavailable"));
                resolve({ durationSeconds: duration });
            });
        });
    } finally {
        await fs.unlink(filePath).catch(() => {});
    }
}
