import "dotenv/config";
import { prisma } from "../lib/prisma";
import { extractKeyFromUrl, getObjectBuffer } from "../lib/s3";
import { videoMetadata } from "../lib/videoMetadata";

async function backfill() {
    let cursor = 0;
    let updated = 0;
    let failed = 0;
    while (true) {
        const files = await prisma.assetFile.findMany({
            where: {
                id: { gt: cursor }, purpose: "ORIGINAL", fileType: { startsWith: "video/" },
                asset: { category: "VIDEO", isDeleted: false },
                OR: [{ width: null }, { height: null }, { durationSeconds: null }, { frameRate: null }],
            }, orderBy: { id: "asc" }, take: 50,
        });
        if (!files.length) break;
        for (const file of files) {
            cursor = file.id;
            try {
                const buffer = await getObjectBuffer(extractKeyFromUrl(file.fileUrl));
                const metadata = await videoMetadata(buffer);
                await prisma.assetFile.update({ where: { id: file.id }, data: metadata });
                updated++;
            } catch {
                console.error(`Could not read metadata for video file ${file.id}`);
                failed++;
            }
        }
    }
    console.log(`Video metadata: ${updated} updated, ${failed} unavailable.`);
    if (failed) process.exitCode = 1;
}

backfill().catch(() => {
    console.error("Video metadata backfill failed");
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
