import "dotenv/config";
import { prisma } from "../lib/prisma";
import { extractKeyFromUrl, getObjectBuffer } from "../lib/s3";
import { imageDimensions } from "../lib/imageDimensions";

async function backfill() {
    let cursor = 0;
    let updated = 0;
    let failed = 0;
    while (true) {
        const files = await prisma.assetFile.findMany({
            where: {
                id: { gt: cursor }, purpose: "ORIGINAL", fileType: { startsWith: "image/" },
                asset: { category: "IMAGE", isDeleted: false },
                OR: [{ width: null }, { height: null }],
            },
            orderBy: { id: "asc" }, take: 50,
        });
        if (!files.length) break;
        for (const file of files) {
            cursor = file.id;
            try {
                const buffer = await getObjectBuffer(extractKeyFromUrl(file.fileUrl));
                const dimensions = await imageDimensions(buffer);
                await prisma.assetFile.update({ where: { id: file.id }, data: dimensions });
                updated++;
            } catch {
                console.error(`Could not read dimensions for file ${file.id}`);
                failed++;
            }
        }
    }
    console.log(`Image dimensions: ${updated} updated, ${failed} unavailable.`);
    if (failed) process.exitCode = 1;
}

backfill().catch(() => {
    console.error("Image dimension backfill failed");
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
