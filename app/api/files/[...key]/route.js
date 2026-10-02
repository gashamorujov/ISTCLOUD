import { downloadFile, deleteFile, renameFile, getFile, isStorageConfigured, normalizeStorageItem } from "@/lib/storage";
import { atomicDelete, updateFileMetadata } from "@/lib/fb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { key } = await params;
    const fileId = Array.isArray(key) ? key.join("/") : key;

    if (!isStorageConfigured()) {
      return Response.json(
        { error: "Storage not configured. Please check environment variables." },
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

    const contentType = meta?.mimeType || stream.headers?.get("content-type") || "application/octet-stream";
    const contentLength = Number(meta?.size) || Number(stream.headers?.get("content-length")) || 0;
    const name = meta?.name || fileId.split("/").pop();

    const headers = {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
    };
    if (contentLength) headers["Content-Length"] = String(contentLength);
    if (range && stream.status === 206) {
      headers["Content-Range"] = stream.headers?.get("content-range") || "";
      headers["Accept-Ranges"] = "bytes";
    }

    return new Response(stream.body, { status: stream.status, headers });
  } catch (error) {
    console.error("Stream error:", error.message);
    return Response.json(
      { error: error.status === 404 ? "File not found or already deleted" : (error.message || "File not found") },
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
          message: "Deletion failed",
        },
        { status: result.error === "File not found" ? 404 : 500 }
      );
    }

    return Response.json({
      success: true,
      steps: result.steps,
      message: "File completely deleted from storage, database and links cleaned",
    });
  } catch (error) {
    console.error("Delete error:", error.message);
    return Response.json({ error: "Deletion failed", details: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { key } = await params;
    const fileId = Array.isArray(key) ? key.join("/") : key;
    const body = await request.json().catch(() => ({}));
    const newName = String(body.name || "").trim();
    if (!newName) {
      return Response.json({ error: "New file name required" }, { status: 400 });
    }

    const updated = await renameFile(fileId, newName);
    await updateFileMetadata(fileId, {
      name: updated.name,
      original_name: updated.name,
      last_modified: updated.lastModified || new Date().toISOString(),
    });

    return Response.json({ success: true, file: normalizeStorageItem(updated) });
  } catch (error) {
    console.error("Rename error:", error.message);
    return Response.json({ error: "Failed to rename file", details: error.message }, { status: 500 });
  }
}
