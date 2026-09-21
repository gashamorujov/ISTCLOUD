import { downloadFile, deleteFile, renameFile, getFile, isDriveConfigured, normalizeDriveItem } from "@/lib/google-drive";
import { atomicDelete, updateFileMetadata } from "@/lib/fb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { key } = await params;
    const fileId = Array.isArray(key) ? key.join("/") : key;

    if (!isDriveConfigured()) {
      return Response.json(
        { error: "Google Drive bağlantısı qurulmadı. Zəhmət olmasa daha sonra yenidən cəhd edin." },
        { status: 500 }
      );
    }

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
    const name = meta?.name || fileId;

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
    console.error("Stream error:", error?.detail || error.message, error?.status || "");
    return Response.json(
      { error: error?.status === 404 ? "Fayl tapılmadı və ya artıq silinib." : (error.message || "Fayl tapılmadı") },
      { status: error?.status === 404 ? 404 : 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { key } = await params;
    const fileId = Array.isArray(key) ? key.join("/") : key;

    const result = await atomicDelete(fileId, deleteFile);

    if (!result.success) {
      return Response.json(
        {
          success: false,
          error: result.error,
          steps: result.steps,
          message: "Silinmə uğursuz oldu",
        },
        { status: result.error === "Fayl tapılmadı" ? 404 : 500 }
      );
    }

    return Response.json({
      success: true,
      steps: result.steps,
      message: "Fayl tamamilə silindi — Google Drive, database və linklər təmizləndi",
    });
  } catch (error) {
    console.error("Delete error:", error?.detail || error.message, error?.status || "");
    return Response.json({ error: "Silinmə uğursuz oldu", details: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { key } = await params;
    const fileId = Array.isArray(key) ? key.join("/") : key;
    const body = await request.json().catch(() => ({}));
    const newName = String(body.name || "").trim();
    if (!newName) {
      return Response.json({ error: "Yeni fayl adı tələb olunur" }, { status: 400 });
    }

    const updated = await renameFile(fileId, newName);
    await updateFileMetadata(fileId, {
      name: updated.name,
      original_name: updated.name,
      last_modified: updated.modifiedTime || new Date().toISOString(),
    });

    return Response.json({ success: true, file: normalizeDriveItem(updated) });
  } catch (error) {
    console.error("Rename error:", error?.detail || error.message, error?.status || "");
    return Response.json({ error: "Faylın adı dəyişdirilə bilmədi", details: error.message }, { status: 500 });
  }
}
