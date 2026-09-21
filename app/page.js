"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Dropzone from "./components/Dropzone";
import SearchBar from "./components/SearchBar";
import FileList from "./components/FileList";
import FileViewer from "./components/FileViewer";
import { IconGrid, IconList, IconFolderPlus, IconArrowUp, IconClose } from "./components/Icons";

function uploadWithProgress(url, file, folder, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || "Yükləmə uğursuz oldu"));
        } catch {
          reject(new Error("Yükləmə uğursuz oldu"));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Şəbəkə xətası"));
    const body = new FormData();
    body.append("file", file, file.name);
    if (folder) body.append("folder", folder);
    xhr.send(body);
  });
}

function formatStorage(bytes) {
  if (!bytes) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export default function UserPanel() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date");
  const [view, setView] = useState("list");
  const [uploads, setUploads] = useState([]);
  const [viewingFile, setViewingFile] = useState(null);
  const [error, setError] = useState("");
  const [rootFolderId, setRootFolderId] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [storageInfo, setStorageInfo] = useState(null);
  const [shareLink, setShareLink] = useState(null);

  const loadStorage = useCallback(async () => {
    try {
      const res = await fetch("/api/storage");
      if (res.ok) setStorageInfo(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadFiles = useCallback(async (folderId, q, s) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (folderId) params.set("folder", folderId);
      if (q) params.set("q", q);
      if (s) params.set("sort", s);
      const res = await fetch(`/api/files?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Xəta baş verdi");
        setFiles([]);
      } else {
        setFiles(data.files || []);
        if (!currentFolder && data.folderId) {
          setRootFolderId(data.folderId);
          setCurrentFolder(data.folderId);
        }
      }
    } catch {
      setFiles([]);
      setError("Şəbəkə xətası. Zəhmət olmasa yenidən cəhd edin.");
    } finally {
      setLoading(false);
    }
  }, [currentFolder]);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadFiles(null, query, sort);
    } else if (currentFolder) {
      loadFiles(currentFolder, query, sort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder]);
  useEffect(() => { loadStorage(); }, [loadStorage]);
  useEffect(() => {
    if (!initializedRef.current) return;
    const t = setTimeout(() => loadFiles(currentFolder, query, sort), 300);
    return () => clearTimeout(t);
  }, [query, sort, currentFolder]);

  async function handleFilesSelected(selected) {
    const jobs = selected.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      progress: 0,
      error: null,
    }));
    setUploads((prev) => [...prev, ...jobs]);
    for (const job of jobs) {
      try {
        await uploadWithProgress("/api/files", job.file, currentFolder, (progress) => {
          setUploads((prev) => prev.map((u) => (u.id === job.id ? { ...u, progress } : u)));
        });
        setUploads((prev) => prev.filter((u) => u.id !== job.id));
        loadFiles(currentFolder, query, sort);
        loadStorage();
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) => (u.id === job.id ? { ...u, error: err.message, progress: 0 } : u))
        );
      }
    }
  }

  function handleDownload(file) {
    if (file.url) window.open(file.url, "_blank");
  }

  function handleView(file) { setViewingFile(file); }

  function handleOpenFolder(folder) {
    setBreadcrumb((prev) => [...prev, { id: currentFolder, name: folder.name }]);
    setCurrentFolder(folder.id);
  }

  function navigateBreadcrumb(index) {
    if (index === -1) {
      setCurrentFolder(rootFolderId);
      setBreadcrumb([]);
    } else {
      setCurrentFolder(breadcrumb[index].id);
      setBreadcrumb((prev) => prev.slice(0, index));
    }
  }

  async function handleCreateFolder() {
    const name = prompt("Yeni qovluq adı:");
    if (!name || !name.trim()) return;
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parent: currentFolder }),
      });
      if (res.ok) loadFiles(currentFolder, query, sort);
    } catch { /* ignore */ }
  }

  async function handleRename(file) {
    const name = prompt("Yeni fayl/qovluq adı:", file.name);
    if (!name || !name.trim() || name.trim() === file.name) return;
    try {
      const res = await fetch(`/api/files/${file.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) loadFiles(currentFolder, query, sort);
    } catch { /* ignore */ }
  }

  async function handleShare(file) {
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.key }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const url = `${window.location.origin}${data.url}`;
        setShareLink({ url, name: file.name });
        try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <Image src="/logo.png" alt="Fayl Meneceri" width={72} height={72} className="rounded-2xl shadow-lg shadow-indigo-200/50 object-contain" priority />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">Fayl Meneceri</h1>
          <p className="max-w-md text-sm text-slate-500 mt-1">Faylınızı yükləyin, saxlayın və istənilən vaxt geri əldə edin.</p>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar onSearch={setQuery} placeholder="Fayl adı ilə axtar..." onAdminTrigger={() => { sessionStorage.setItem("adminAutoLogin", "1"); window.location.href = "/admin"; }} />
        <div className="flex items-center gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="date">Tarixə görə</option>
            <option value="name">Adına görə</option>
            <option value="size">Ölçüyə görə</option>
          </select>
          <button onClick={() => setView(view === "grid" ? "list" : "grid")} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 transition" title={view === "grid" ? "Siyahı görünüşü" : "Tor görünüşü"}>
            {view === "grid" ? <IconList className="w-4 h-4" /> : <IconGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Breadcrumb + actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => navigateBreadcrumb(-1)} className="text-indigo-600 hover:underline">CloudStorage</button>
        {breadcrumb.map((b, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-slate-300">/</span>
            <button onClick={() => navigateBreadcrumb(i)} className="text-indigo-600 hover:underline">{b.name}</button>
          </span>
        ))}
        <button onClick={handleCreateFolder} className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition flex items-center gap-1" title="Yeni qovluq">
          <IconFolderPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Qovluq yarat</span>
        </button>
      </div>

      {/* Storage bar */}
      {storageInfo && storageInfo.total > 0 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between">
            <span>İstifadə olunan: {formatStorage(storageInfo.used)} / {formatStorage(storageInfo.total)}</span>
            <span>{storageInfo.user}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (storageInfo.used / storageInfo.total) * 100)}%` }} />
          </div>
        </div>
      )}

      <section className="mb-6">
        <Dropzone onFilesSelected={handleFilesSelected} />
      </section>

      {uploads.length > 0 && (
        <section className="mb-6 space-y-2">
          {uploads.map((u) => (
            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate font-medium text-slate-600">{u.name}</span>
                <span className={u.error ? "text-red-500" : "text-slate-400"}>
                  {u.error ? "Xəta: " + u.error : `${u.progress}%`}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all duration-300 ${u.error ? "bg-red-400" : "bg-indigo-500"}`} style={{ width: `${u.progress}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}

      <FileList
        files={files}
        loading={loading}
        onDownload={handleDownload}
        onOpenFolder={handleOpenFolder}
        onRename={handleRename}
        onShare={handleShare}
        onView={handleView}
        view={view}
        insideFolder={currentFolder && currentFolder !== rootFolderId}
      />

      {/* Share modal */}
      {shareLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShareLink(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Paylaşma linki</h3>
              <button onClick={() => setShareLink(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><IconClose className="w-4 h-4" /></button>
            </div>
            <p className="mb-2 text-xs text-slate-500 truncate">{shareLink.name}</p>
            <input readOnly value={shareLink.url} className="mb-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 select-all" onClick={(e) => e.target.select()} />
            <button onClick={() => { navigator.clipboard.writeText(shareLink.url).catch(() => {}); setShareLink(null); }} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">Linki kopyala</button>
          </div>
        </div>
      )}

      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} onDownload={handleDownload} />}
    </main>
  );
}
