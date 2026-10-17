import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

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

export async function getPresignedDownloadUrl(key: string): Promise<{ url: string; expiresIn: number }> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const url = await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN });
  return { url, expiresIn: EXPIRES_IN };
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);
  const byteArray = await response.Body!.transformToByteArray();
  return Buffer.from(byteArray);
}

export async function getObjectStream(key: string): Promise<Readable> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);
  return response.Body as Readable;
}

export async function putObjectBuffer(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
  });
  await s3.send(command);
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.key}`;
}

export async function deleteObject(key: string): Promise<void> {
  if (key.startsWith("nft-originals/")) throw new Error("NFT snapshots cannot be deleted");
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await s3.send(command);
}

export async function putNftOriginalSnapshot(hash: string, body: Buffer): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid NFT content hash");
  const key = `nft-originals/${hash}`;
  try {
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body,
      ContentType: "application/octet-stream", IfNoneMatch: "*" }));
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error;
    // An existing object must contain exactly the same content.
    const { createHash } = await import('node:crypto');
    const existing = await getObjectBuffer(key);
    if (createHash('sha256').update(existing).digest('hex') !== hash) throw new Error('NFT snapshot integrity check failed');
  }
  return key;
}

export function extractKeyFromUrl(fileUrl: string): string {
  const url = new URL(fileUrl);
  return url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
}

export async function copyObjectForPreview(sourceKey: string, key: string): Promise<string> {
  await s3.send(new CopyObjectCommand({
    Bucket: BUCKET,
    Key: key,
    CopySource: encodeURIComponent(`${BUCKET}/${sourceKey}`),
    MetadataDirective: "REPLACE",
    ContentType: "model/gltf-binary",
  }));
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}
