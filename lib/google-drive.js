import { JWT } from "google-auth-library";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DEFAULT_MIME = "application/octet-stream";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const API_BASE = process.env.GOOGLE_DRIVE_API_BASE || "https://www.googleapis.com";
const UPLOAD_BASE = process.env.GOOGLE_DRIVE_UPLOAD_BASE || "https://www.googleapis.com/upload/drive/v3";

let cachedToken = null;
let rootFolderIdCache = null;
let mockFiles = [];
let mockFolders = new Map();
let mockIdCounter = 0;

function generateMockId() {
  return `mock_${Date.now()}_${++mockIdCounter}`;
}

function isMockMode() {
  return !!process.env.GOOGLE_DRIVE_MOCK_TOKEN;
}

export function isDriveConfigured() {
  if (isMockMode()) return true;
  if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT) return true;
  return Boolean(process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY);
}

function readServiceAccount() {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      raw.includes("{") ? raw : Buffer.from(raw, "base64").toString("utf8")
    );
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key || parsed.privateKey,
    };
  } catch {
    return null;
  }
}

async function getAccessToken() {
  if (isMockMode()) return process.env.GOOGLE_DRIVE_MOCK_TOKEN;

  const account = readServiceAccount();
  const client = new JWT({
    email: account?.client_email || process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    key: (account?.private_key || process.env.GOOGLE_DRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: [DRIVE_SCOPE],
  });
  const token = await client.getAccessToken();
  if (!token?.token) throw new Error("Google Drive autentifikasiyası alınmadı");
  cachedToken = token.token;
  return cachedToken;
}

function authHeaders() {
  if (isMockMode()) return { Authorization: `Bearer ${process.env.GOOGLE_DRIVE_MOCK_TOKEN}` };
  return { Authorization: `Bearer ${cachedToken}` };
}

function escapeQ(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function userError(status, fallback) {
  if (!status || status === 401 || status === 403) {
    return "Google Drive bağlantısı qurulmadı. Zəhmət olmasa daha sonra yenidən cəhd edin.";
  }
  if (status === 429) {
    return "Google Drive API limitinə çatıldı. Biraz sonra yenidən cəhd edin.";
  }
  if (status === 404) {
    return "Fayl tapılmadı və ya artıq silinib.";
  }
  return fallback;
}

async function driveFetch(url, options) {
  if (isMockMode()) {
    // Mock implementation
    console.log("Mock driveFetch:", url, options?.method || "GET");
    return mockDriveResponse(url, options);
  }
  
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Google Drive bağlantısı qurulmadı. Zəhmət olmasa daha sonra yenidən cəhd edin.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message || body?.error?.status || "";
    } catch {
      detail = "";
    }
    const err = new Error(userError(res.status, "Google Drive əməliyyatı uğursuz oldu. Yenidən cəhd edin."));
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res;
}

function mockDriveResponse(url, options) {
  const method = options?.method || "GET";
  
  if (url.includes("/drive/v3/about")) {
    return {
      ok: true,
      json: async () => ({
        storageQuota: { limit: "107374182400", usage: "0" },
        user: { emailAddress: "mock@local.dev" }
      }),
      headers: new Headers(),
      status: 200,
    };
  }
  
  if (url.includes("/drive/v3/files") && method === "GET") {
    const items = [...mockFolders.values(), ...mockFiles].map(normalizeDriveItemForMock);
    return {
      ok: true,
      json: async () => ({ files: items, nextPageToken: null }),
      headers: new Headers(),
      status: 200,
    };
  }
  
  if (url.includes("/drive/v3/files") && method === "POST") {
    const body = JSON.parse(options?.body?.toString() || "{}");
    const newItem = {
      id: generateMockId(),
      name: body.name,
      mimeType: body.mimeType,
      size: "0",
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      parents: body.parents,
    };
    if (body.mimeType === FOLDER_MIME) {
      mockFolders.set(newItem.id, newItem);
    } else {
      mockFiles.push(newItem);
    }
    return {
      ok: true,
      json: async () => newItem,
      headers: new Headers(),
      status: 200,
    };
  }
  
  if (url.includes("/drive/v3/files/") && method === "DELETE") {
    const fileId = url.split("/files/")[1]?.split("?")[0];
    mockFolders.delete(fileId);
    mockFiles = mockFiles.filter(f => f.id !== fileId);
    return { ok: true, status: 204 };
  }
  
  if (url.includes("/drive/v3/files/") && method === "PATCH") {
    const fileId = url.split("/files/")[1]?.split("?")[0];
    const body = JSON.parse(options?.body?.toString() || "{}");
    let item = mockFolders.get(fileId) || mockFiles.find(f => f.id === fileId);
    if (item) {
      item.name = body.name;
      item.modifiedTime = new Date().toISOString();
    }
    return {
      ok: true,
      json: async () => item,
      headers: new Headers(),
      status: 200,
    };
  }
  
  if (url.includes("alt=media")) {
    const fileId = url.split("/files/")[1]?.split("?")[0];
    const item = mockFolders.get(fileId) || mockFiles.find(f => f.id === fileId);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": item?.mimeType || "application/octet-stream", "content-length": "0" }),
      body: new ReadableStream(),
    };
  }
  
  if (url.includes("/drive/v3/files/") && method === "GET") {
    const fileId = url.split("/files/")[1]?.split("?")[0];
    const item = mockFolders.get(fileId) || mockFiles.find(f => f.id === fileId);
    if (!item) {
      const err = new Error("File not found");
      err.status = 404;
      throw err;
    }
    return {
      ok: true,
      json: async () => item,
      headers: new Headers(),
      status: 200,
    };
  }

  return { ok: false, status: 404, json: async () => ({}) };
}

function normalizeDriveItemForMock(item) {
  const isFolder = item.mimeType === FOLDER_MIME;
  return {
    id: item.id,
    name: item.name,
    mimeType: item.mimeType || DEFAULT_MIME,
    size: item.size || "0",
    createdTime: item.createdTime,
    modifiedTime: item.modifiedTime,
    parents: item.parents,
    trashed: false,
  };
}

export async function getRootFolderId() {
  if (isMockMode()) {
    if (!mockFolders.has("root")) {
      mockFolders.set("root", {
        id: "root",
        name: "CloudStorage",
        mimeType: FOLDER_MIME,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        parents: [],
      });
    }
    return "root";
  }
  
  if (rootFolderIdCache) return rootFolderIdCache;
  if (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    rootFolderIdCache = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    return rootFolderIdCache;
  }

  cachedToken = await getAccessToken();
  const searchUrl = `${API_BASE}/drive/v3/files?q=${encodeURIComponent(
    `name='CloudStorage' and 'root' in parents and mimeType='${FOLDER_MIME}' and trashed=false`
  )}&fields=files(id,name)&pageSize=1`;
  const res = await driveFetch(searchUrl, { headers: authHeaders() });
  const data = await res.json();
  if (data?.files?.length) {
    rootFolderIdCache = data.files[0].id;
    return rootFolderIdCache;
  }

  const created = await createFolder("CloudStorage", null);
  rootFolderIdCache = created.id;
  return rootFolderIdCache;
}

export async function listFolder({ folderId, search = "", sort = "date" }) {
  if (isMockMode()) {
    await getRootFolderId();
    const parent = folderId || "root";
    let items = [...mockFolders.values(), ...mockFiles].filter(f => {
      if (f.id === "root") return parent === "root";
      const parentPath = f.parents?.[0] || "root";
      return parentPath === parent;
    });
    
    if (search) {
      items = items.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    }
    
    const sortMap = {
      name: (a, b) => a.name.localeCompare(b.name),
      date: (a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime),
      size: (a, b) => (Number(b.size) || 0) - (Number(a.size) || 0),
      type: (a, b) => (a.mimeType || "").localeCompare(b.mimeType || ""),
    };
    items.sort(sortMap[sort] || sortMap.date);
    return items.map(normalizeDriveItemForMock);
  }

  cachedToken = await getAccessToken();
  const parent = folderId || (await getRootFolderId());

  let q = search
    ? `name contains '${escapeQ(search)}' and trashed=false`
    : `'${escapeQ(parent)}' in parents and trashed=false`;

  const orderMap = {
    name: "name",
    date: "modifiedTime desc",
    size: "size desc",
    type: "mimeType",
  };
  const orderBy = orderMap[sort] || orderMap.date;

  const url = `${API_BASE}/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=${encodeURIComponent(orderBy)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,parents,trashed),nextPageToken&pageSize=1000&supportsAllDrives=true`;
  const res = await driveFetch(url, { headers: authHeaders() });
  return (await res.json()).files || [];
}

export async function getFile(fileId) {
  if (isMockMode()) {
    const item = mockFolders.get(fileId) || mockFiles.find(f => f.id === fileId);
    if (!item) {
      const err = new Error("File not found");
      err.status = 404;
      throw err;
    }
    return normalizeDriveItemForMock(item);
  }

  cachedToken = await getAccessToken();
  const url = `${API_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents,trashed,webViewLink&supportsAllDrives=true`;
  const res = await driveFetch(url, { headers: authHeaders() });
  return res.json();
}

export async function downloadFile(fileId, range) {
  if (isMockMode()) {
    const item = mockFolders.get(fileId) || mockFiles.find(f => f.id === fileId);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": item?.mimeType || "application/octet-stream", "content-length": "0" }),
      body: new ReadableStream(),
    };
  }

  cachedToken = await getAccessToken();
  const url = `${API_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const headers = authHeaders();
  if (range) headers.Range = range;
  const res = await driveFetch(url, { headers });
  return res;
}

export async function uploadFile({ name, mimeType = DEFAULT_MIME, buffer, folderId }) {
  if (isMockMode()) {
    await getRootFolderId();
    const parent = folderId || "root";
    const newItem = {
      id: generateMockId(),
      name,
      mimeType,
      size: String(buffer.length),
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      parents: [parent],
    };
    mockFiles.push(newItem);
    return newItem;
  }

  cachedToken = await getAccessToken();
  const size = buffer.length;
  const parents = folderId ? [folderId] : undefined;
  const metadata = { name, mimeType, parents };

  if (size <= 5 * 1024 * 1024) {
    const url = `${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,parents`;
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" }),
      "metadata.json"
    );
    form.append("file", new Blob([buffer], { type: mimeType }), name);
    const res = await driveFetch(url, { method: "POST", headers: authHeaders(), body: form });
    return res.json();
  }

  const initUrl = `${UPLOAD_BASE}/files?uploadType=resumable&fields=id,name,mimeType,size,createdTime,modifiedTime,parents&supportsAllDrives=true`;
  const initRes = await driveFetch(initUrl, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify(metadata),
  });
  const location = initRes.headers.get("location");
  if (!location) throw new Error("Google Drive resumable upload başladıla bilmədi");

  const putRes = await driveFetch(location, {
    method: "PUT",
    headers: {
      ...authHeaders(),
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: new Blob([buffer]),
  });
  return putRes.json();
}

export async function deleteFile(fileId) {
  if (isMockMode()) {
    mockFolders.delete(fileId);
    mockFiles = mockFiles.filter(f => f.id !== fileId);
    return fileId;
  }

  cachedToken = await getAccessToken();
  const url = `${API_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`;
  await driveFetch(url, { method: "DELETE", headers: authHeaders() });
  return fileId;
}

export async function renameFile(fileId, newName) {
  if (isMockMode()) {
    const item = mockFolders.get(fileId) || mockFiles.find(f => f.id === fileId);
    if (item) {
      item.name = String(newName).trim();
      item.modifiedTime = new Date().toISOString();
    }
    return item;
  }

  cachedToken = await getAccessToken();
  const url = `${API_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,mimeType,size,createdTime,modifiedTime,parents`;
  const res = await driveFetch(url, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: String(newName).trim() }),
  });
  return res.json();
}

export async function createFolder(name, parentId) {
  if (isMockMode()) {
    await getRootFolderId();
    const parent = parentId || "root";
    const newFolder = {
      id: generateMockId(),
      name: String(name).trim(),
      mimeType: FOLDER_MIME,
      size: "0",
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      parents: [parent],
    };
    mockFolders.set(newFolder.id, newFolder);
    return newFolder;
  }

  cachedToken = await getAccessToken();
  const url = `${API_BASE}/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType,createdTime,modifiedTime,parents`;
  const body = {
    name: String(name).trim(),
    mimeType: FOLDER_MIME,
    parents: parentId ? [parentId] : undefined,
  };
  const res = await driveFetch(url, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getStorageInfo() {
  if (isMockMode()) {
    return {
      total: 107374182400,
      used: mockFiles.reduce((sum, f) => sum + Number(f.size || 0), 0),
      remaining: 107374182400 - mockFiles.reduce((sum, f) => sum + Number(f.size || 0), 0),
      user: "mock@local.dev",
    };
  }

  cachedToken = await getAccessToken();
  const url = `${API_BASE}/drive/v3/about?fields=storageQuota,user`;
  const res = await driveFetch(url, { headers: authHeaders() });
  const data = await res.json();
  const quota = data?.storageQuota || {};
  return {
    total: Number(quota.limit) || 0,
    used: Number(quota.usage) || 0,
    remaining: Number(quota.limit) ? Math.max(0, Number(quota.limit) - Number(quota.usage)) : 0,
    user: data?.user?.emailAddress || null,
  };
}

export const DRIVE_FOLDER_MIME = FOLDER_MIME;

export function normalizeDriveItem(item) {
  const isFolder = item.mimeType === FOLDER_MIME;
  return {
    id: item.id,
    key: item.id,
    name: item.name,
    size: Number(item.size) || 0,
    mimeType: item.mimeType || DEFAULT_MIME,
    kind: isFolder ? "folder" : "file",
    folderId: item.parents?.[0] || null,
    createdAt: item.createdTime || null,
    lastModified: item.modifiedTime || item.createdTime || null,
    url: isFolder ? null : `/api/files/${encodeURIComponent(item.id)}`,
  };
}
