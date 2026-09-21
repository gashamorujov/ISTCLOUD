import { getFileInfo } from "@/lib/hot4share";
import { saveFileMetadata } from "@/lib/fb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fileCode = String(body.fileCode || body.file_code || body.key || "").trim();
    if (!fileCode) {
      return Response.json({ error: "fileCode tələb olunur" }, { status: 400 });
    }

    const name = String(body.name || fileCode);
    const size = Number(body.size) || 0;
    const contentType = body.contentType || body.content_type || "application/octet-stream";
    const lastModified = body.lastModified || new Date().toISOString();

    let info = null;
    try {
      info = await getFileInfo(fileCode);
    } catch {
      info = null;
    }

    const finalName = info?.name || name;
    const finalSize = info?.size || size;
    const uploaded = info?.uploaded || lastModified;

    await saveFileMetadata({
      key: fileCode,
      name: finalName,
      originalName: name,
      size: finalSize,
      contentType,
      storageUrl: `/api/files/${encodeURIComponent(fileCode)}`,
      lastModified: uploaded,
    });

    return Response.json({
      success: true,
      file: {
        key: fileCode,
        name: finalName,
        originalName: name,
        size: finalSize,
        contentType,
        url: `/api/files/${encodeURIComponent(fileCode)}`,
        lastModified: uploaded,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return Response.json(
      { error: "Metadata qeydə alına bilmədi", details: error.message },
      { status: 500 }
    );
  }
}
