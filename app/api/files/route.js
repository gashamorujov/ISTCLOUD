import { uploadFile, makeKey } from "@/lib/s3";
import { saveFileMetadata, listFiles } from "@/lib/fb-db";

function normalizeFile(row) {
  const encodedKey = encodeURIComponent(row.s3_key);
  return {
    key: row.s3_key,
    name: row.name,
    originalName: row.original_name,
    size: row.size,
    contentType: row.content_type,
    url: `/api/files/${encodedKey}`,
    lastModified: row.last_modified || row.created_at,
    createdAt: row.created_at,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || searchParams.get("q") || "";
    const rows = await listFiles({ search });
    const files = rows.map(normalizeFile);
    return Response.json({ files });
  } catch (error) {
    console.error("List files error:", error);
    return Response.json({ error: "Fayl siyahısı alına bilmədi", files: [] }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "Fayl təqdim edilməyib" }, { status: 400 });
    }

    const key = makeKey(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadFile({
      key,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });

    const encodedKey = encodeURIComponent(result.key);
    const proxyUrl = `/api/files/${encodedKey}`;

    saveFileMetadata({
      key: result.key,
      name: file.name,
      originalName: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
      storageUrl: proxyUrl,
      lastModified: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      file: {
        key: result.key,
        name: file.name,
        size: file.size,
        url: proxyUrl,
        lastModified: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({ error: "Yükləmə uğursuz oldu", details: error.message }, { status: 500 });
  }
}
