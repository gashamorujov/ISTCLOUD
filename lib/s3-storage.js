import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DEFAULT_MIME = "application/octet-stream";

// S3 Configuration from environment
const S3_ENDPOINT = process.env.S3_ENDPOINT || "https://s3.eu-west-1.filonecontent.com";
const S3_REGION = process.env.S3_REGION || "eu-west-1";
const S3_BUCKET = process.env.S3_BUCKET || "ist";
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === "true";

// Create S3 client
let s3Client = null;

function getS3Client() {
  if (!s3Client && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: S3_FORCE_PATH_STYLE,
    });
  }
  return s3Client;
}

export function isS3Configured() {
  return Boolean(S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
}

// Escape special characters for S3 key
function escapeKey(key) {
  return key.replace(/[#?]/g, encodeURIComponent);
}

// Generate folder prefix
function getFolderPrefix(folderId) {
  if (!folderId || folderId === "root") return "";
  return `${folderId}/`;
}

// Convert Node.js stream to Web API ReadableStream
function toWebStream(nodeStream) {
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of nodeStream) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

// Normalize S3 object to file format
function normalizeS3Item(item, folderId) {
  const key = item.Key || item.key;
  const isFolder = key.endsWith("/");
  const name = isFolder ? key.slice(0, -1).split("/").pop() : key.split("/").pop();
  const parentPath = key.substring(0, key.lastIndexOf("/") + 1);
  const parentId = parentPath === folderId + "/" ? folderId : parentPath.slice(0, -1) || "root";

  return {
    id: key,
    key: key,
    name: name,
    size: Number(item.Size || item.size) || 0,
    mimeType: isFolder ? FOLDER_MIME : (item.ContentType || DEFAULT_MIME),
    kind: isFolder ? "folder" : "file",
    folderId: parentId,
    createdAt: item.LastModified || new Date().toISOString(),
    lastModified: item.LastModified || new Date().toISOString(),
    url: isFolder ? null : `/api/files/${encodeURIComponent(key)}`,
  };
}

export async function listFolder({ folderId = "root", search = "", sort = "date" }) {
  const client = getS3Client();
  if (!client) throw new Error("S3 storage not configured");

  const prefix = getFolderPrefix(folderId);
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
    Delimiter: "/",
  });

  const response = await client.send(command);
  const items = [];

  // Add folders (CommonPrefixes)
  if (response.CommonPrefixes) {
    for (const prefix of response.CommonPrefixes) {
      const folderName = prefix.Prefix.slice(0, -1).split("/").pop();
      if (!search || folderName.toLowerCase().includes(search.toLowerCase())) {
        items.push({
          Key: prefix.Prefix,
          Size: 0,
          LastModified: new Date().toISOString(),
          ContentType: FOLDER_MIME,
        });
      }
    }
  }

  // Add files (Contents)
  if (response.Contents) {
    for (const obj of response.Contents) {
      // Skip the folder marker itself
      if (obj.Key === prefix) continue;

      const name = obj.Key.split("/").pop();
      if (!search || name.toLowerCase().includes(search.toLowerCase())) {
        items.push(obj);
      }
    }
  }

  // Sort
  const sortMap = {
    name: (a, b) => (a.Key || a.key).localeCompare(b.Key || b.key),
    date: (a, b) => new Date(b.LastModified || b.lastModified) - new Date(a.LastModified || a.lastModified),
    size: (a, b) => (Number(b.Size || b.size) || 0) - (Number(a.Size || a.size) || 0),
    type: (a, b) => (a.ContentType || "").localeCompare(b.ContentType || ""),
  };

  items.sort(sortMap[sort] || sortMap.date);

  return items.map(item => normalizeS3Item(item, folderId));
}

export async function getFile(fileId) {
  const client = getS3Client();
  if (!client) throw new Error("S3 storage not configured");

  const command = new HeadObjectCommand({
    Bucket: S3_BUCKET,
    Key: fileId,
  });

  const response = await client.send(command);
  return {
    id: fileId,
    key: fileId,
    name: fileId.split("/").pop(),
    size: Number(response.ContentLength) || 0,
    mimeType: response.ContentType || DEFAULT_MIME,
    lastModified: response.LastModified?.toISOString() || new Date().toISOString(),
  };
}

export async function downloadFile(fileId, range) {
  const client = getS3Client();
  if (!client) throw new Error("S3 storage not configured");

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: fileId,
    Range: range,
  });

  const response = await client.send(command);
  
  // Convert Node.js stream to Web API ReadableStream
  const webStream = toWebStream(response.Body);
  
  // Create a response-like object with web-compatible stream
  return {
    status: response.$metadata.httpStatusCode,
    headers: new Headers({
      "content-type": response.ContentType || DEFAULT_MIME,
      "content-length": String(response.ContentLength || 0),
      "accept-ranges": "bytes",
      "content-range": response.ContentRange || "",
    }),
    body: webStream,
  };
}

export async function uploadFile({ name, mimeType = DEFAULT_MIME, buffer, folderId = "root" }) {
  const client = getS3Client();
  if (!client) throw new Error("S3 storage not configured");

  const prefix = getFolderPrefix(folderId);
  const key = `${prefix}${name}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await client.send(command);

  return {
    id: key,
    key: key,
    name: name,
    size: buffer.length,
    mimeType: mimeType,
    lastModified: new Date().toISOString(),
  };
}

export async function deleteFile(fileId) {
  const client = getS3Client();
  if (!client) throw new Error("S3 storage not configured");

  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: fileId,
  });

  await client.send(command);
  return fileId;
}

export async function renameFile(fileId, newName) {
  const client = getS3Client();
  if (!client) throw new Error("S3 storage not configured");

  const newKey = fileId.substring(0, fileId.lastIndexOf("/") + 1) + newName;

  const copyCommand = new CopyObjectCommand({
    Bucket: S3_BUCKET,
    CopySource: `${S3_BUCKET}/${fileId}`,
    Key: newKey,
  });

  await client.send(copyCommand);

  // Delete old file
  const deleteCommand = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: fileId,
  });

  await client.send(deleteCommand);

  return {
    id: newKey,
    key: newKey,
    name: newName,
    mimeType: DEFAULT_MIME,
    lastModified: new Date().toISOString(),
  };
}

export async function createFolder(name, parentId = "root") {
  const client = getS3Client();
  if (!client) throw new Error("S3 storage not configured");

  const prefix = getFolderPrefix(parentId);
  const key = `${prefix}${name}/`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: "",
    ContentType: FOLDER_MIME,
  });

  await client.send(command);

  return {
    id: key,
    key: key,
    name: name,
    size: 0,
    mimeType: FOLDER_MIME,
    lastModified: new Date().toISOString(),
  };
}

export async function getStorageInfo() {
  const client = getS3Client();
  if (!client) throw new Error("S3 storage not configured");

  // List all objects to calculate storage usage
  let totalSize = 0;
  let continuationToken = null;

  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        totalSize += Number(obj.Size) || 0;
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return {
    total: 100 * 1024 * 1024 * 1024, // 100GB default
    used: totalSize,
    remaining: Math.max(0, 100 * 1024 * 1024 * 1024 - totalSize),
    user: S3_ACCESS_KEY_ID,
  };
}

export const S3_FOLDER_MIME = FOLDER_MIME;

export function normalizeS3ItemForUI(item) {
  return normalizeS3Item(item, "root");
}
