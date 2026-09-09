import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), "lib", "admin-config.json");

function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return { password: process.env.ADMIN_PASSWORD || "0706" };
  }
}

function writeConfig(data) {
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function POST(request) {
  try {
    const { currentPassword, newPassword } = await request.json();
    const config = readConfig();

    if (currentPassword !== config.password) {
      return Response.json({ error: "Cari şifrə yanlışdır" }, { status: 401 });
    }

    if (!newPassword || newPassword.length < 3) {
      return Response.json({ error: "Yeni şifrə minimum 3 simvol olmalıdır" }, { status: 400 });
    }

    config.password = newPassword;
    writeConfig(config);

    return Response.json({ success: true, message: "Şifrə uğurla dəyişdirildi" });
  } catch (error) {
    return Response.json({ error: "Şifrə dəyişdirilmədi", details: error.message }, { status: 500 });
  }
}
