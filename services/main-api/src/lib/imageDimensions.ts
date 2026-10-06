import sharp from "sharp";

export async function imageDimensions(input: Buffer): Promise<{ width: number; height: number }> {
    const metadata = await sharp(input).metadata();
    const width = metadata.width;
    const height = metadata.pageHeight ?? metadata.height;
    if (!width || !height) throw new Error("Image dimensions are unavailable");
    // EXIF rotations 5–8 swap the displayed axes.
    return metadata.orientation && metadata.orientation >= 5
        ? { width: height, height: width } : { width, height };
}
