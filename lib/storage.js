import { isDriveConfigured, listFolder as driveListFolder, getFile as driveGetFile, downloadFile as driveDownloadFile, uploadFile as driveUploadFile, deleteFile as driveDeleteFile, renameFile as driveRenameFile, createFolder as driveCreateFolder, getStorageInfo as driveGetStorageInfo, getRootFolderId as driveGetRootFolderId, normalizeDriveItem } from "./google-drive";
import { isS3Configured, listFolder as s3ListFolder, getFile as s3GetFile, downloadFile as s3DownloadFile, uploadFile as s3UploadFile, deleteFile as s3DeleteFile, renameFile as s3RenameFile, createFolder as s3CreateFolder, getStorageInfo as s3GetStorageInfo, normalizeS3ItemForUI as s3NormalizeItem } from "./s3-storage";

export function getStorageType() {
  if (isS3Configured()) return "s3";
  if (isDriveConfigured()) return "drive";
  return "mock";
}

export async function listFolder({ folderId, search = "", sort = "date" }) {
  const type = getStorageType();
  if (type === "s3") {
    return s3ListFolder({ folderId, search, sort });
  }
  return driveListFolder({ folderId, search, sort });
}

export async function getFile(fileId) {
  const type = getStorageType();
  if (type === "s3") {
    return s3GetFile(fileId);
  }
  return driveGetFile(fileId);
}

export async function downloadFile(fileId, range) {
  const type = getStorageType();
  if (type === "s3") {
    return s3DownloadFile(fileId, range);
  }
  return driveDownloadFile(fileId, range);
}

export async function uploadFile({ name, mimeType = "application/octet-stream", buffer, folderId }) {
  const type = getStorageType();
  if (type === "s3") {
    return s3UploadFile({ name, mimeType, buffer, folderId });
  }
  return driveUploadFile({ name, mimeType, buffer, folderId });
}

export async function deleteFile(fileId) {
  const type = getStorageType();
  if (type === "s3") {
    return s3DeleteFile(fileId);
  }
  return driveDeleteFile(fileId);
}

export async function renameFile(fileId, newName) {
  const type = getStorageType();
  if (type === "s3") {
    return s3RenameFile(fileId, newName);
  }
  return driveRenameFile(fileId, newName);
}

export async function createFolder(name, parentId) {
  const type = getStorageType();
  if (type === "s3") {
    return s3CreateFolder(name, parentId);
  }
  return driveCreateFolder(name, parentId);
}

export async function getStorageInfo() {
  const type = getStorageType();
  if (type === "s3") {
    return s3GetStorageInfo();
  }
  return driveGetStorageInfo();
}

export async function getRootFolderId() {
  const type = getStorageType();
  if (type === "s3") {
    return "root";
  }
  return driveGetRootFolderId();
}

export function isStorageConfigured() {
  return isS3Configured() || isDriveConfigured();
}

export function normalizeStorageItem(item) {
  const type = getStorageType();
  if (type === "s3") {
    return s3NormalizeItem(item);
  }
  return normalizeDriveItem(item);
}

export const STORAGE_FOLDER_MIME = "application/vnd.google-apps.folder";

export { isDriveConfigured, isS3Configured };
