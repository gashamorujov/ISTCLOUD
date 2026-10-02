import { listFolder, getRootFolderId, uploadFile, isStorageConfigured, normalizeStorageItem } from "@/lib/storage";
import { saveFileMetadata } from "@/lib/fb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    if (!isStorageConfigured()) {
      return Response.json(
        { error: "Storage not configured. Please check environment variables.", files: [] },
        { status: 500 }
      );
    }
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || (await getRootFolderId());
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const sort = searchParams.get("sort") || "date";

    const items = await listFolder({ folderId: folder, search, sort });
    const files = items.map(normalizeStorageItem);
    return Response.json({ files, folderId: folder });
  } catch (error) {
    console.error("List files error:", error.message);
    return Response.json({ error: error.message || "Failed to list files", files: [] }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isStorageConfigured()) {
      return Response.json(
        { error: "Storage not configured. Please check environment variables." },
        { status: 500 }
      );
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const folderId = String(formData.get("folder") || "") || (await getRootFolderId());
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) {
      return Response.json({ error: "Cannot upload empty file" }, { status: 400 });
    }

    const contentType = file.type || "application/octet-stream";
    const storageFile = await uploadFile({
      name: file.name,
      mimeType: contentType,
      buffer,
      folderId,
    });

    const item = normalizeStorageItem(storageFile);
    await saveFileMetadata({
      key: storageFile.id,
      name: storageFile.name,
      originalName: file.name,
      size: storageFile.size || buffer.length,
      contentType: storageFile.mimeType || contentType,
      storageUrl: item.url,
      folderId,
      lastModified: storageFile.lastModified || new Date().toISOString(),
    });

    return Response.json({ success: true, file: item });
  } catch (error) {
    console.error("Upload error:", error.message);
    return Response.json({ error: error.message || "Upload failed", details: error.message }, { status: 500 });
  }
}
