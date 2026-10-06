import "dotenv/config";
import { prisma } from "../lib/prisma";
import { extractKeyFromUrl, getObjectBuffer } from "../lib/s3";
import { audioMetadata } from "../lib/audioMetadata";

async function backfill() {
    let cursor = 0;
    let updated = 0;
    let failed = 0;
    while (true) {
        const files = await prisma.assetFile.findMany({
            where: {
                id: { gt: cursor }, purpose: "ORIGINAL", fileType: { startsWith: "audio/" },
                asset: { category: "SOUND_EFFECT", isDeleted: false },
                durationSeconds: null,
            }, orderBy: { id: "asc" }, take: 50,
        });
        if (!files.length) break;
        for (const file of files) {
            cursor = file.id;
            try {
                const buffer = await getObjectBuffer(extractKeyFromUrl(file.fileUrl));
                const metadata = await audioMetadata(buffer);
                await prisma.assetFile.update({ where: { id: file.id }, data: metadata });
                updated++;
            } catch {
                console.error(`Could not read metadata for audio file ${file.id}`);
                failed++;
            }
        }
    }
    console.log(`Audio metadata: ${updated} updated, ${failed} unavailable.`);
    if (failed) process.exitCode = 1;
}

backfill().catch(() => {
    console.error("Audio metadata backfill failed");
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
