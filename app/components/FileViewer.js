"use client";

import { useEffect, useCallback, useState } from "react";
import { formatBytes, formatDate } from "@/lib/format";
import { getFileType, IconClose, IconDownload, IconAlert } from "./Icons";

export default function FileViewer({ file, onClose, onDownload }) {
  const url = file.url || null;

  const ft = getFileType(file.name);
  const Icon = ft.icon;

  const handleKey = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const isVideo = ["mp4", "webm", "ogg", "mov", "mkv", "avi", "m4v"].includes(ext);
  const isAudio = ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext);
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff", "avif"].includes(ext);
  const isPdf = ext === "pdf";
  const isText = ["txt", "csv", "json", "log", "md", "xml", "html", "css", "js", "ts"].includes(ext);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-fade-in max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ft.bg}`}>
            <Icon className={`w-5 h-5 ${ft.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-400">
              {formatBytes(file.size)} · {formatDate(file.lastModified)}
            </p>
          </div>
          {onDownload && (
            <button
              onClick={() => onDownload(file)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition flex items-center gap-1.5"
              title="Endir"
            >
              <IconDownload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Endir</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="Bağla (Esc)"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-50">
          {!url && (
            <div className="flex flex-col items-center justify-center p-12 min-h-[40vh] text-center gap-4">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${ft.bg}`}>
                <IconAlert className="w-10 h-10 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
                <p className="mt-1 text-xs text-slate-400 max-w-sm">
                  Fayla giriş əldə edilmədi.
                </p>
              </div>
              {onDownload && (
                <button
                  onClick={() => onDownload(file)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <IconDownload className="w-4 h-4" />
                  Faylı endir
                </button>
              )}
            </div>
          )}

          {url && isImage && (
            <div className="flex items-center justify-center p-4 min-h-[50vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={file.name}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-md"
              />
            </div>
          )}

          {url && isVideo && (
            <div className="flex items-center justify-center p-4 min-h-[50vh]">
              <video
                src={url}
                controls
                autoPlay
                className="max-w-full max-h-[65vh] rounded-lg shadow-md bg-black"
                controlsList="nodownload"
              />
            </div>
          )}

          {url && isAudio && (
            <div className="flex flex-col items-center justify-center p-8 min-h-[40vh] gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${ft.bg}`}>
                <Icon className={`w-8 h-8 ${ft.color}`} />
              </div>
              <audio src={url} controls autoPlay className="w-full max-w-md" />
            </div>
          )}

          {url && isPdf && (
            <iframe
              src={`${url}#toolbar=1&navpanes=0`}
              title={file.name}
              className="w-full h-[70vh] bg-white"
            />
          )}

          {url && isText && (
            <iframe
              src={url}
              title={file.name}
              className="w-full h-[70vh] bg-white"
            />
          )}

          {url && !isImage && !isVideo && !isAudio && !isPdf && !isText && (
            <div className="flex flex-col items-center justify-center p-12 min-h-[40vh] text-center gap-4">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${ft.bg}`}>
                <Icon className={`w-10 h-10 ${ft.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
                <p className="mt-1 text-xs text-slate-400 max-w-sm">
                  Bu fayl növü üçün daxili ön baxış mövcud deyil. Faylın məzmununu görmək üçün endirin.
                </p>
              </div>
              {onDownload && (
                <button
                  onClick={() => onDownload(file)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <IconDownload className="w-4 h-4" />
                  Faylı endir
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 sm:px-6 bg-white">
          <p className="text-xs text-slate-400">
            Daimi keçid — fayl həmişə əlçatandır
          </p>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition"
          >
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
}
