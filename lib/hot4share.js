const API_BASE = "https://hot4share.com/api";

function apiKey() {
  const key = process.env.HOT4SHARE_API_KEY;
  if (!key) throw new Error("HOT4SHARE_API_KEY təyin olunmayıb (.env.local yoxlayın)");
  return key;
}

async function apiGet(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("key", apiKey());
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Hot4Share cavabı oxuna bilmədi (${path})`);
  }
  if (!data || data.status !== 200) {
    throw new Error(data?.msg || `Hot4Share xətası (${path})`);
  }
  return data.result;
}

export async function getAccountInfo() {
  return apiGet("/account/info");
}

let uploadServerCache = null;
let uploadServerCachedAt = 0;

export async function getUploadServer() {
  if (uploadServerCache && Date.now() - uploadServerCachedAt < 10 * 60 * 1000) {
    return uploadServerCache;
  }
  const url = new URL(`${API_BASE}/upload/server`);
  url.searchParams.set("key", apiKey());
  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const data = await res.json();
  if (!data || data.status !== 200 || !data.result || !data.sess_id) {
    throw new Error(data?.msg || "Upload serveri alına bilmədi");
  }
  const server = { url: data.result, sessId: data.sess_id };
  if (!server.url || !server.sessId) throw new Error("Upload serveri alına bilmədi");
  uploadServerCache = server;
  uploadServerCachedAt = Date.now();
  return server;
}

export async function uploadBuffer({ buffer, filename, contentType }) {
  const { url, sessId } = await getUploadServer();
  const form = new FormData();
  form.append("sess_id", sessId);
  form.append("utype", "prem");
  form.append("file_0_descr", filename);
  form.append("file_0", new Blob([buffer], { type: contentType || "application/octet-stream" }), filename);

  const target = `${url}?upload_type=file&sess_id=${encodeURIComponent(sessId)}&utype=prem`;
  const res = await fetch(target, { method: "POST", body: form });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Upload cavabı oxuna bilmədi");
  }
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || first.file_status !== "OK" || !first.file_code) {
    throw new Error(first?.file_status || "Yükləmə Hot4Share tərəfindən rədd edildi");
  }
  return first.file_code;
}

export async function getFileInfo(fileCode) {
  const result = await apiGet("/file/info", { file_code: fileCode });
  const info = Array.isArray(result) ? result[0] : result;
  if (!info || info.status === 404 || !info.filecode) return null;
  return {
    fileCode: info.filecode,
    name: info.name,
    size: Number(info.size) || 0,
    uploaded: info.uploaded || null,
    downloads: Number(info.downloads) || 0,
  };
}

export async function listAllFiles() {
  const perPage = 100;
  let page = 1;
  const all = [];
  for (;;) {
    const result = await apiGet("/file/list", { page, per_page: perPage });
    const files = result?.files || [];
    for (const f of files) {
      all.push({
        fileCode: f.file_code,
        name: f.name,
        size: Number(f.size) || 0,
        uploaded: f.uploaded || null,
        downloads: Number(f.downloads) || 0,
        pageUrl: f.link || null,
      });
    }
    const total = Number(result?.results_total) || all.length;
    if (all.length >= total || files.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

export async function getDirectLink(fileCode) {
  const result = await apiGet("/file/direct_link", { file_code: fileCode });
  if (!result?.url) throw new Error("Birbaşa keçid alına bilmədi");
  return { url: result.url, size: Number(result?.size) || 0 };
}

export async function tryRemoteDelete(fileCode) {
  try {
    await apiGet("/file/delete", { file_code: fileCode });
    return { ok: true };
  } catch (err) {
    const msg = err?.message || "";
    if (/invalid operation/i.test(msg)) {
      return { ok: false, supported: false, message: "Hot4Share API uzaqdan silmə əməliyyatını dəstəkləmir" };
    }
    return { ok: false, supported: true, message: msg };
  }
}

const MIME_BY_EXT = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
  tif: "image/tiff", tiff: "image/tiff", avif: "image/avif",
  mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg", mov: "video/quicktime",
  mkv: "video/x-matroska", avi: "video/x-msvideo", m4v: "video/x-m4v",
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", flac: "audio/flac", aac: "audio/aac",
  pdf: "application/pdf",
  txt: "text/plain", csv: "text/csv", json: "application/json", log: "text/plain",
  md: "text/markdown", xml: "application/xml", html: "text/html", css: "text/css",
  js: "text/javascript", ts: "text/plain",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
};

export function guessContentType(filename, fallback) {
  const ext = (String(filename).split(".").pop() || "").toLowerCase();
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (fallback && fallback !== "application/octet-stream") return fallback;
  return "application/octet-stream";
}
