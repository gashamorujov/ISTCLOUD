import { readFileSync } from "fs";
import { join } from "path";

export async function POST(request) {
  try {
    const { password } = await request.json();

    let adminPassword = process.env.ADMIN_PASSWORD || "0706";
    try {
      const config = JSON.parse(readFileSync(join(process.cwd(), "lib", "admin-config.json"), "utf-8"));
      if (config.password) adminPassword = config.password;
    } catch {}

    if (password && password === adminPassword) {
      return Response.json({ success: true });
    }
    return Response.json({ error: "Yanlış parol" }, { status: 401 });
  } catch (err) {
    return Response.json({ error: "Xəta baş verdi" }, { status: 500 });
  }
}
