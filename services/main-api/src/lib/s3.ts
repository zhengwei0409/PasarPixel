import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;
const EXPIRES_IN = Number(process.env.S3_PRESIGNED_URL_EXPIRES_IN ?? 900);

export async function getPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<{ url: string; key: string; expiresIn: number }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN });

  return { url, key: params.key, expiresIn: EXPIRES_IN };
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await s3.send(command);
}

export function extractKeyFromUrl(fileUrl: string): string {
  const url = new URL(fileUrl);
  return url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
}
