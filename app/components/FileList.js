"use client";

import { formatBytes, formatDate } from "@/lib/format";
import { getFileType, IconDownload, IconTrash, IconEye, IconFolder, IconRename, IconLinkShare, IconFolderPlus } from "./Icons";

export default function FileList({
  files,
  loading,
  onDownload,
  onDelete,
  onView,
  onRename,
  onShare,
  onOpenFolder,
  isAdmin = false,
  deletingKey = null,
  view = "list",
  insideFolder = false,
}) {
  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">Yüklənir...</div>;
  }

  if (!files || files.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
        {insideFolder ? "Bu qovluq boşdur." : "Heç bir fayl tapılmadı."}
      </div>
    );
  }

  const ftOf = (name, isFolder) => {
    if (isFolder) return { label: "Qovluq", bg: "bg-amber-50", color: "text-amber-500", icon: IconFolder };
    return getFileType(name);
  };

  const actions = (f) => {
    const isDel = deletingKey === f.key;
    if (isDel) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500">
          <span className="h-3.5 w-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
          silinir...
        </span>
      );
    }
    const isFolder = f.kind === "folder";
    return (
      <div className="flex items-center gap-1">
        {isFolder && onOpenFolder && (
          <button
            onClick={() => onOpenFolder(f)}
            className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 transition"
            title="Qovluğu aç"
          >
            Aç
          </button>
        )}
        {!isFolder && onView && (
          <button
            onClick={() => onView(f)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Bax
          </button>
        )}
        {!isFolder && (
          <button
            onClick={() => onDownload(f)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition"
          >
            Endir
          </button>
        )}
        {onShare && !isFolder && (
          <button
            onClick={() => onShare(f)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-500 hover:bg-slate-100 transition"
            title="Paylaşma linki"
          >
            <IconLinkShare className="w-3.5 h-3.5" />
          </button>
        )}
        {onRename && (
          <button
            onClick={() => onRename(f)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-500 hover:bg-slate-100 transition"
            title="Adı dəyiş"
          >
            <IconRename className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(f)}
            className="rounded-lg border border-red-200 px-2 py-1.5 text-red-500 hover:bg-red-50 transition"
            title="Sil"
          >
            <IconTrash className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  if (view === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {files.map((f) => {
          const isDel = deletingKey === f.key;
          const isFolder = f.kind === "folder";
          const ft = ftOf(f.name, isFolder);
          const Icon = ft.icon;
          return (
            <div
              key={f.key}
              className={`group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition ${
                isDel ? "opacity-50 bg-red-50/40" : isFolder ? "hover:border-amber-300" : "hover:border-indigo-300"
              }`}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <button
                  onClick={() => (isFolder ? onOpenFolder?.(f) : onView?.(f))}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${ft.bg}`}
                  title={isFolder ? "Qovluğu aç" : "Bax"}
                >
                  <Icon className={`w-6 h-6 ${ft.color}`} />
                </button>
                <p className="w-full truncate text-xs font-medium text-slate-700">{f.name}</p>
                <p className="text-[11px] text-slate-400">
                  {isFolder ? "Qovluq" : `${formatBytes(f.size)} · ${formatDate(f.lastModified)}`}
                </p>
                <div className="mt-1 flex justify-center">{actions(f)}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Mobil kartlar */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {files.map((f) => {
          const isDel = deletingKey === f.key;
          const isFolder = f.kind === "folder";
          const ft = ftOf(f.name, isFolder);
          const Icon = ft.icon;
          return (
            <div key={f.key} className={`flex items-center gap-3 p-3 transition ${isDel ? "opacity-50 bg-red-50/40" : ""}`}>
              <button
                onClick={() => (isFolder ? onOpenFolder?.(f) : onView?.(f))}
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ft.bg}`}
              >
                <Icon className={`w-5 h-5 ${ft.color}`} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{f.name}</p>
                <p className="text-xs text-slate-400">
                  {isFolder ? "Qovluq" : `${formatBytes(f.size)} · ${formatDate(f.lastModified)}`}
                </p>
              </div>
              <div className="shrink-0">{actions(f)}</div>
            </div>
          );
        })}
      </div>

      {/* Masaüstü cədvəl */}
      <table className="hidden w-full text-left text-sm sm:table">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Fayl</th>
            <th className="px-4 py-3 font-medium">Ölçü</th>
            <th className="px-4 py-3 font-medium">Yükləmə tarixi</th>
            <th className="px-4 py-3 font-medium text-right">Əməliyyat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {files.map((f) => {
            const isDel = deletingKey === f.key;
            const isFolder = f.kind === "folder";
            const ft = ftOf(f.name, isFolder);
            const Icon = ft.icon;
            return (
              <tr key={f.key} className={`transition ${isDel ? "bg-red-50/40 opacity-60" : "hover:bg-slate-50/70"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 max-w-md">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${ft.bg}`}>
                      <Icon className={`w-5 h-5 ${ft.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{f.name}</p>
                      <p className="text-xs text-slate-400">{ft.label}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{isFolder ? "—" : formatBytes(f.size)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(f.kind === "folder" ? f.createdAt : f.lastModified)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">{actions(f)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
