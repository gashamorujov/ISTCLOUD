import { getRootFolderId, createFolder, isStorageConfigured, normalizeStorageItem } from "@/lib/storage";
import { saveFileMetadata } from "@/lib/fb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!isStorageConfigured()) {
      return Response.json(
        { error: "Storage not configured. Please check environment variables." },
        { status: 500 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) {
      return Response.json({ error: "Folder name required" }, { status: 400 });
    }

    const parentId = String(body.parent || "") || (await getRootFolderId());
    const folder = await createFolder(name, parentId);
    const item = normalizeStorageItem(folder);

    await saveFileMetadata({
      key: folder.id,
      name: folder.name,
      originalName: folder.name,
      size: 0,
      contentType: folder.mimeType,
      storageUrl: null,
      folderId: parentId,
      lastModified: folder.lastModified || new Date().toISOString(),
    });

    return Response.json({ success: true, folder: item });
  } catch (error) {
    console.error("Create folder error:", error.message);
    return Response.json({ error: "Failed to create folder", details: error.message }, { status: 500 });
  }
}
