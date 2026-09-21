import { listFolder, getRootFolderId, uploadFile, isDriveConfigured, normalizeDriveItem } from "@/lib/google-drive";
import { saveFileMetadata } from "@/lib/fb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    if (!isDriveConfigured()) {
      return Response.json(
        { error: "Google Drive bağlantısı qurulmadı. Zəhmət olmasa daha sonra yenidən cəhd edin.", files: [] },
        { status: 500 }
      );
    }
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || (await getRootFolderId());
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const sort = searchParams.get("sort") || "date";

    const items = await listFolder({ folderId: folder, search, sort });
    const files = items.map(normalizeDriveItem);
    return Response.json({ files, folderId: folder });
  } catch (error) {
    console.error("List files error:", error?.detail || error.message, error?.status || "");
    return Response.json({ error: error.message || "Fayl siyahısı alına bilmədi", files: [] }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isDriveConfigured()) {
      return Response.json(
        { error: "Google Drive bağlantısı qurulmadı. Zəhmət olmasa daha sonra yenidən cəhd edin." },
        { status: 500 }
      );
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json({ error: "Fayl təqdim edilməyib" }, { status: 400 });
    }

    const folderId = String(formData.get("folder") || "") || (await getRootFolderId());
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) {
      return Response.json({ error: "Boş fayl yükləmək olmur" }, { status: 400 });
    }

    const contentType = file.type || "application/octet-stream";
    const driveFile = await uploadFile({
      name: file.name,
      mimeType: contentType,
      buffer,
      folderId,
    });

    const item = normalizeDriveItem(driveFile);
    await saveFileMetadata({
      key: driveFile.id,
      name: driveFile.name,
      originalName: file.name,
      size: driveFile.size || buffer.length,
      contentType: driveFile.mimeType || contentType,
      storageUrl: item.url,
      folderId,
      lastModified: driveFile.modifiedTime || new Date().toISOString(),
    });

    return Response.json({ success: true, file: item });
  } catch (error) {
    console.error("Upload error:", error?.detail || error.message, error?.status || "");
    const msg = error?.status === 429
      ? "Google Drive API limitinə çatıldı. Biraz sonra yenidən cəhd edin."
      : (error.message && /bağlantısı qurulmadı|uğursuz oldu/.test(error.message))
        ? error.message
        : "Fayl yüklənmədi. Yenidən cəhd edin.";
    return Response.json({ error: msg, details: error.message }, { status: 500 });
  }
}
