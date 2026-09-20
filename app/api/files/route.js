import { uploadBuffer, listAllFiles, getFileInfo, guessContentType } from "@/lib/hot4share";
import { saveFileMetadata, getMetaMap, getHiddenCodes } from "@/lib/fb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeFile(remote, meta) {
  const code = remote.fileCode;
  const encodedKey = encodeURIComponent(code);
  return {
    key: code,
    name: remote.name,
    originalName: meta?.original_name || remote.name,
    size: remote.size,
    contentType: meta?.content_type || guessContentType(remote.name),
    url: `/api/files/${encodedKey}`,
    pageUrl: remote.pageUrl || null,
    downloads: remote.downloads || 0,
    lastModified: meta?.last_modified || remote.uploaded || null,
    createdAt: meta?.created_at || (remote.uploaded ? Date.parse(remote.uploaded) || null : null),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim().toLowerCase();

    const [remotes, metas, hidden] = await Promise.all([
      listAllFiles(),
      getMetaMap().catch(() => ({})),
      getHiddenCodes().catch(() => new Set()),
    ]);

    let files = remotes
      .filter((r) => !hidden.has(r.fileCode))
      .map((r) => normalizeFile(r, metas?.[r.fileCode]));

    if (search) {
      files = files.filter(
        (f) =>
          (f.name && f.name.toLowerCase().includes(search)) ||
          (f.originalName && f.originalName.toLowerCase().includes(search)) ||
          (f.key && f.key.toLowerCase().includes(search))
      );
    }

    files.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return Response.json({ files });
  } catch (error) {
    console.error("List files error:", error);
    return Response.json({ error: "Fayl siyahısı alına bilmədi", details: error.message, files: [] }, { status: 500 });
  }
}

async function extractUpload(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return null;
    return { blob: file, filename: file.name || "fayl", type: file.type || "" };
  }
  const buffer = Buffer.from(await request.arrayBuffer());
  if (!buffer.length) return null;
  const { searchParams } = new URL(request.url);
  const filename =
    request.headers.get("x-filename") ||
    searchParams.get("filename") ||
    "fayl";
  return { blob: new Blob([buffer], { type: contentType.split(";")[0] || "application/octet-stream" }), filename, type: contentType.split(";")[0] };
}

export async function POST(request) {
  try {
    const upload = await extractUpload(request);
    if (!upload) {
      return Response.json({ error: "Fayl təqdim edilməyib" }, { status: 400 });
    }

  const buffer = Buffer.from(await upload.blob.arrayBuffer());
    if (!buffer.length) {
      return Response.json({ error: "Boş fayl yükləmək olmur" }, { status: 400 });
    }

    const contentType = guessContentType(upload.filename, upload.type);
    const fileCode = await uploadBuffer({ buffer, filename: upload.filename, contentType });

    let info = null;
    try {
      info = await getFileInfo(fileCode);
    } catch {
      info = null;
    }

    const name = info?.name || upload.filename;
    const size = info?.size || buffer.length;
    const uploaded = info?.uploaded || new Date().toISOString();
    const encodedKey = encodeURIComponent(fileCode);
    const proxyUrl = `/api/files/${encodedKey}`;

    await saveFileMetadata({
      key: fileCode,
      name,
      originalName: upload.filename,
      size,
      contentType,
      storageUrl: proxyUrl,
      lastModified: uploaded,
    });

    return Response.json({
      success: true,
      file: {
        key: fileCode,
        name,
        originalName: upload.filename,
        size,
        contentType,
        url: proxyUrl,
        lastModified: uploaded,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({ error: "Yükləmə uğursuz oldu", details: error.message }, { status: 500 });
  }
}
