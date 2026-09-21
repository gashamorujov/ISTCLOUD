import { getStorageInfo, isDriveConfigured } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isDriveConfigured()) {
      return Response.json(
        { error: "Google Drive bağlantısı qurulmadı. Zəhmət olmasa daha sonra yenidən cəhd edin." },
        { status: 500 }
      );
    }
    const info = await getStorageInfo();
    return Response.json(info);
  } catch (error) {
    console.error("Storage info error:", error?.detail || error.message, error?.status || "");
    return Response.json({ error: error.message || "Storage məlumatı alına bilmədi" }, { status: 500 });
  }
}
