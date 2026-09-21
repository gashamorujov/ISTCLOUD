import { getUploadServer } from "@/lib/hot4share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { url, sessId } = await getUploadServer();
    return Response.json(
      { url, sessId, expiresAt: Date.now() + 9 * 60 * 1000 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Upload init error:", error);
    return Response.json(
      { error: "Upload serveri alına bilmədi", details: error.message },
      { status: 500 }
    );
  }
}
