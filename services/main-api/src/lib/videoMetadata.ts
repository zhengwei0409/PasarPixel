import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export interface VideoMetadata {
    width: number;
    height: number;
    durationSeconds: number | null;
    frameRate: number | null;
}

function positiveRate(value: string | undefined): number | null {
    if (!value) return null;
    const [numerator, denominator = "1"] = value.split("/");
    const rate = Number(numerator) / Number(denominator);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export async function videoMetadata(input: Buffer): Promise<VideoMetadata> {
    const filePath = join(tmpdir(), `${randomUUID()}-metadata-video`);
    await fs.writeFile(filePath, input);
    try {
        return await new Promise<VideoMetadata>((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (error, data) => {
                if (error) return reject(error);
                const stream = data.streams.find((item) => item.codec_type === "video" && !item.disposition?.attached_pic);
                if (!stream?.width || !stream.height) return reject(new Error("Video dimensions are unavailable"));
                const rotation = Number(stream.side_data_list?.find((item: { rotation?: number }) => item.rotation !== undefined)?.rotation ?? stream.rotation ?? stream.tags?.rotate ?? 0);
                const swapAxes = Math.abs(rotation % 180) === 90;
                const duration = Number(stream.duration ?? data.format.duration);
                resolve({
                    width: swapAxes ? stream.height : stream.width,
                    height: swapAxes ? stream.width : stream.height,
                    durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : null,
                    frameRate: positiveRate(stream.avg_frame_rate) ?? positiveRate(stream.r_frame_rate),
                });
            });
        });
    } finally {
        await fs.unlink(filePath).catch(() => {});
    }
}
