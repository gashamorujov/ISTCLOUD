import { getShareLink } from "@/lib/fb-db";
import { downloadFile, getFile, isDriveConfigured } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const link = await getShareLink(Array.isArray(token) ? token[0] : token);
    if (!link || !link.file) {
      return Response.json({ error: "Paylaşma linki tapılmadı və ya deaktiv edilib" }, { status: 404 });
    }

    if (!isDriveConfigured()) {
      return Response.json(
        { error: "Google Drive bağlantısı qurulmadı. Zəhmət olmasa daha sonra yenidən cəhd edin." },
        { status: 500 }
      );
    }

    const fileId = link.file_id || link.file?.id || link.file?.file_id;
    const range = request.headers.get("range") || undefined;
    const stream = await downloadFile(fileId, range);

    let meta = null;
    try {
      meta = await getFile(fileId);
    } catch {
      meta = null;
    }

    const contentType = meta?.mimeType || stream.headers.get("content-type") || "application/octet-stream";
    const contentLength = Number(meta?.size) || Number(stream.headers.get("content-length")) || 0;
    const name = meta?.name || link.file?.name || fileId;

    const headers = {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
    };
    if (contentLength) headers["Content-Length"] = String(contentLength);
    if (range && stream.status === 206) {
      headers["Content-Range"] = stream.headers.get("content-range") || "";
      headers["Accept-Ranges"] = "bytes";
    }

    return new Response(stream.body, { status: stream.status, headers });
  } catch (error) {
    console.error("Share stream error:", error?.detail || error.message, error?.status || "");
    return Response.json(
      { error: error?.status === 404 ? "Fayl tapılmadı və ya artıq silinib." : (error.message || "Fayl tapılmadı") },
      { status: error?.status === 404 ? 404 : 500 }
    );
  }
}
