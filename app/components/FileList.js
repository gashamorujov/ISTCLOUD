"use client";

import { formatBytes, formatDate } from "@/lib/format";
import { getFileType, IconDownload, IconTrash, IconEye } from "./Icons";

export default function FileList({ files, loading, onDownload, onDelete, onView, isAdmin, deletingKey = null }) {
  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">Yüklənir...</div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
        Heç bir fayl tapılmadı.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Mobil kartlar */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {files.map((f) => {
          const isDel = deletingKey === f.key;
          const ft = getFileType(f.name);
          const Icon = ft.icon;
          return (
            <div key={f.key} className={`flex items-center gap-3 p-3 transition ${isDel ? "opacity-50 bg-red-50/40" : ""}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ft.bg}`}>
                {isDel ? (
                  <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                ) : (
                  <Icon className={`w-5 h-5 ${ft.color}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{f.name}</p>
                <p className="text-xs text-slate-400">
                  {formatBytes(f.size)} · {formatDate(f.lastModified)}
                  {isDel && <span className="ml-1 text-red-500 font-medium">silinir...</span>}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!isDel && onView && (
                  <button
                    onClick={() => onView(f)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition"
                    title="Bax"
                  >
                    <IconEye className="w-4 h-4" />
                  </button>
                )}
                {!isDel && (
                  <button
                    onClick={() => onDownload(f)}
                    className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 transition"
                    title="Endir"
                  >
                    <IconDownload className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && !isDel && (
                  <button
                    onClick={() => onDelete(f)}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50 transition"
                    title="Sil"
                  >
                    <IconTrash className="w-4 h-4" />
                  </button>
                )}
              </div>
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
            const ft = getFileType(f.name);
            const Icon = ft.icon;
            return (
              <tr key={f.key} className={`transition ${isDel ? "bg-red-50/40 opacity-60" : "hover:bg-slate-50/70"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 max-w-md">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${ft.bg}`}>
                      {isDel ? (
                        <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                      ) : (
                        <Icon className={`w-5 h-5 ${ft.color}`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{f.name}</p>
                      <p className="text-xs text-slate-400">{ft.label}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatBytes(f.size)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(f.lastModified)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {!isDel && onView && (
                      <button
                        onClick={() => onView(f)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                      >
                        Bax
                      </button>
                    )}
                    {!isDel && (
                      <button
                        onClick={() => onDownload(f)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition"
                      >
                        Endir
                      </button>
                    )}
                    {isAdmin && !isDel && (
                      <button
                        onClick={() => onDelete(f)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                      >
                        Sil
                      </button>
                    )}
                    {isDel && (
                      <span className="text-xs text-red-500 font-medium py-1.5">silinir...</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
