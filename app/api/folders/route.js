import { getRootFolderId, createFolder, isDriveConfigured, normalizeDriveItem } from "@/lib/google-drive";
import { saveFileMetadata } from "@/lib/fb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!isDriveConfigured()) {
      return Response.json(
        { error: "Google Drive bağlantısı qurulmadı. Zəhmət olmasa daha sonra yenidən cəhd edin." },
        { status: 500 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) {
      return Response.json({ error: "Qovluq adı tələb olunur" }, { status: 400 });
    }

    const parentId = String(body.parent || "") || (await getRootFolderId());
    const folder = await createFolder(name, parentId);
    const item = normalizeDriveItem(folder);

    await saveFileMetadata({
      key: folder.id,
      name: folder.name,
      originalName: folder.name,
      size: 0,
      contentType: folder.mimeType,
      storageUrl: null,
      folderId: parentId,
      lastModified: folder.modifiedTime || new Date().toISOString(),
    });

    return Response.json({ success: true, folder: item });
  } catch (error) {
    console.error("Create folder error:", error?.detail || error.message, error?.status || "");
    return Response.json({ error: "Qovluq yaradıla bilmədi", details: error.message }, { status: 500 });
  }
}
