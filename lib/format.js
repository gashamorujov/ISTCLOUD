export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ICON_KINDS = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"],
  video: ["mp4", "mov", "avi", "mkv", "webm", "wmv"],
  pdf: ["pdf"],
  word: ["doc", "docx", "odt", "rtf"],
  excel: ["xls", "xlsx", "csv", "ods"],
  archive: ["zip", "rar", "7z", "tar", "gz"],
};

export function getFileKind(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  for (const [kind, exts] of Object.entries(ICON_KINDS)) {
    if (exts.includes(ext)) return kind;
  }
  return "other";
}
