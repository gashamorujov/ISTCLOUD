import { getStorageInfo, isStorageConfigured } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isStorageConfigured()) {
      return Response.json(
        { error: "Storage not configured. Please check environment variables." },
        { status: 500 }
      );
    }
    const info = await getStorageInfo();
    return Response.json(info);
  } catch (error) {
    console.error("Storage info error:", error.message);
    return Response.json({ error: error.message || "Failed to get storage info" }, { status: 500 });
  }
}
