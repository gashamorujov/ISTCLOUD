import { getDirectLink } from "@/lib/hot4share";
import { atomicDelete } from "@/lib/fb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  try {
    const { key } = await params;
    const fileCode = Array.isArray(key) ? key.join("/") : key;

    const result = await atomicDelete(fileCode);

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

    const remoteSkipped = result.steps.some((s) => s.op === "storage_delete" && s.status === "skipped");
    return Response.json({
      success: true,
      steps: result.steps,
      message: remoteSkipped
        ? "Fayl paneldən və backend-dən silindi. Qeyd: Hot4Share API uzaqdan silməni dəstəkləmir, fayl Hot4Share hesabında qala bilər."
        : "Fayl tamamilə silindi — storage, database və linklər təmizləndi",
    });
  } catch (error) {
    console.error("Delete error:", error);
    return Response.json(
      { error: "Silinmə uğursuz oldu", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  try {
    const { key } = await params;
    const fileCode = Array.isArray(key) ? key.join("/") : key;

    const { url } = await getDirectLink(fileCode);
    return Response.redirect(url, 302);
  } catch (error) {
    console.error("Stream error:", error);
    return Response.json(
      { error: "Fayl tapılmadı", details: error.message },
      { status: 404 }
    );
  }
}
