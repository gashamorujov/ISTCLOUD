import { createShareLink } from "@/lib/fb-db";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fileId = String(body.fileId || body.key || "").trim();
    if (!fileId) {
      return Response.json({ error: "fileId tələb olunur" }, { status: 400 });
    }

    const token = crypto.randomBytes(16).toString("hex");
    await createShareLink({ fileId, token, expiresAt: null });
    return Response.json({ success: true, url: `/api/share/${token}`, token });
  } catch (error) {
    console.error("Share link error:", error);
    return Response.json({ error: "Paylaşma linki yaradıla bilmədi", details: error.message }, { status: 500 });
  }
}
