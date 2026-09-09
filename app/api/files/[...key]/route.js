import { deleteFile, streamObject } from "@/lib/s3";
import { atomicDelete } from "@/lib/fb-db";

export async function DELETE(request, { params }) {
  try {
    const { key } = await params;
    const decodedKey = Array.isArray(key) ? key.join("/") : key;

    const result = await atomicDelete(decodedKey, deleteFile);

    if (!result.success) {
      return Response.json(
        {
          success: false,
          error: result.error,
          steps: result.steps,
          message: "Silinmə qismən uğursuz oldu",
        },
        { status: result.error === "Fayl tapılmadı" ? 404 : 500 }
      );
    }

    return Response.json({
      success: true,
      steps: result.steps,
      message: "Fayl tamamilə silindi — storage, database və linklər təmizləndi",
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
    const decodedKey = Array.isArray(key) ? key.join("/") : key;

    const result = await streamObject(decodedKey);
    const contentType = result.ContentType || "application/octet-stream";
    const contentLength = result.ContentLength || 0;
    const lastModified = result.LastModified ? result.LastModified.toISOString() : undefined;
    const fileName = decodedKey.split("-").slice(3).join("-") || decodedKey;

    const headers = {
      "Content-Type": contentType,
      "Content-Length": contentLength,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
    };
    if (lastModified) headers["Last-Modified"] = lastModified;

    return new Response(result.Body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Stream error:", error);
    return Response.json(
      { error: "Fayl tapılmadı", details: error.message },
      { status: 404 }
    );
  }
}
