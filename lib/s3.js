import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const endpoint = process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com";
const bucket = process.env.B2_BUCKET_NAME;
const keyId = process.env.B2_KEY_ID;
const appKey = process.env.B2_APPLICATION_KEY;

if (!bucket || !keyId || !appKey) {
  console.warn("[Fayl Meneceri] B2 environment dəyişənləri tam təyin olunmayıb. .env.local faylını yoxlayın.");
}

const s3 = new S3Client({
  region: process.env.B2_REGION || "us-east-005",
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: keyId || "",
    secretAccessKey: appKey || "",
  },
});

export { s3, bucket, endpoint };

// Fayl adını B2 key-inə çeviririk
export function makeKey(originalName) {
  const safeName = originalName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-180);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${rand}-${safeName}`;
}

// Key-dən orijinal fayl adını çıxarırıq
export function parseOriginalName(key) {
  const parts = key.split("-");
  return parts.slice(3).join("-") || key;
}

export async function uploadFile({ key, body, contentType }) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3.send(command);
  return { key };
}

export async function deleteFile(key) {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await s3.send(command);
  return key;
}

// B2-dən fayl məzmununu axıdır (streaming) — daimi server proxy linki üçün
export async function streamObject(key) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await s3.send(command);
}
