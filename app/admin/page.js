"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import SearchBar from "../components/SearchBar";
import FileList from "../components/FileList";
import FileViewer from "../components/FileViewer";
import { IconLock, IconSettings, IconAlert, IconCheck, IconX, IconClose, IconGrid, IconList, IconFolderPlus } from "../components/Icons";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deletionSteps, setDeletionSteps] = useState([]);
  const [deletionResult, setDeletionResult] = useState(null);
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: 0 });
  const [viewingFile, setViewingFile] = useState(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [rootFolderId, setRootFolderId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [sort, setSort] = useState("date");
  const [view, setView] = useState("list");
  const [storageInfo, setStorageInfo] = useState(null);
  const [shareLink, setShareLink] = useState(null);
  const [listError, setListError] = useState("");

  const STEP_LABELS = {
    check: "Fayl yoxlanılır",
    storage_delete: "Storage-dən silinir",
    revoke_links: "Paylaşım linkləri deaktiv edilir",
    db_cleanup: "Verilənlər bazası təmizlənir",
    ui_refresh: "İnterfeys yenilənir",
  };

  useEffect(() => {
    const autoLogin = sessionStorage.getItem("adminAutoLogin");
    if (autoLogin) {
      sessionStorage.removeItem("adminAutoLogin");
      setAuthed(true);
      setChecking(false);
      return;
    }
    const stored = sessionStorage.getItem("adminPassword");
    if (stored) verifyPassword(stored);
    else setChecking(false);
  }, []);

  async function verifyPassword(pw) {
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        setAuthed(true);
        sessionStorage.setItem("adminPassword", pw);
      } else {
        sessionStorage.removeItem("adminPassword");
        setAuthed(false);
      }
    } catch {
      setAuthed(false);
    }
    setChecking(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    const pw = password;
    await verifyPassword(pw);
    if (!authed) setLoginError("Yanlış parol");
  }

  const loadFiles = useCallback(async (folderId = null, q = "", s = "date") => {
    setLoading(true);
    setListError("");
    try {
      const params = new URLSearchParams();
      if (folderId) params.set("folder", folderId);
      if (q) params.set("q", q);
      if (s) params.set("sort", s);
      const res = await fetch(`/api/files?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setListError(data.error || "Xəta baş verdi");
        setFiles([]);
      } else {
        const arr = data.files || [];
        setFiles(arr);
        setStats({
          totalFiles: arr.length,
          totalSize: arr.reduce((s, f) => s + (f.size || 0), 0),
        });
        if (!folderId && data.folderId) setRootFolderId(data.folderId);
      }
    } catch {
      setFiles([]);
      setListError("Şəbəkə xətası");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStorage = useCallback(async () => {
    try {
      const res = await fetch("/api/storage");
      if (res.ok) setStorageInfo(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (authed) loadFiles(currentFolder, query, sort); }, [authed, loadFiles]);
  useEffect(() => { if (authed) loadStorage(); }, [authed, loadStorage]);
  useEffect(() => {
    if (!authed) return;
    const t = setTimeout(() => loadFiles(currentFolder, query, sort), 300);
    return () => clearTimeout(t);
  }, [query, sort, authed, currentFolder]);

  function handleDelete(file) {
    setDeleteConfirm(file);
    setDeletionResult(null);
    setDeletionSteps([]);
  }

  async function confirmDelete(file) {
    setDeleteConfirm(null);
    setDeleting(true);
    setDeletionSteps([]);
    setDeletionResult(null);

    try {
      const res = await fetch(`/api/files/${encodeURIComponent(file.key)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.steps) setDeletionSteps(data.steps);
      if (data.success) {
        setDeletionResult("success");
        setFiles((p) => p.filter((f) => f.key !== file.key));
        setStats((p) => ({ totalFiles: p.totalFiles - 1, totalSize: p.totalSize - (file.size || 0) }));
      } else {
        setDeletionResult("failed");
      }
    } catch (err) {
      setDeletionSteps([{ op: "error", status: "failed", message: err.message }]);
      setDeletionResult("failed");
    } finally {
      setDeleting(false);
    }
  }

  function handleDownload(file) {
    const encodedKey = encodeURIComponent(file.key);
    const url = file.url || `/api/files/${encodedKey}`;
    window.open(url, "_blank");
  }

  function handleView(file) {
    setViewingFile(file);
  }

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

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwLoading(true);
    setPwMsg("");
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (data.success) {
        setPwMsg({ type: "success", text: data.message || "Şifrə dəyişdirildi" });
        setPwCurrent("");
        setPwNew("");
        sessionStorage.setItem("adminPassword", pwNew);
      } else {
        setPwMsg({ type: "error", text: data.error || "Şifrə dəyişdirilmədi" });
      }
    } catch {
      setPwMsg({ type: "error", text: "Şəbəkə xətası" });
    } finally {
      setPwLoading(false);
    }
  }

  const fmtBytes = (b) => {
    if (!b) return "0 B";
    const u = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
  };

  if (checking) return null;

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-white">
              <IconLock className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">Admin Panel</h1>
            <p className="text-xs text-slate-400 mt-1">Davam etmək üçün admin parolunu daxil edin</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parol"
            autoFocus
            className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
          />
          {loginError && <p className="mb-3 text-xs text-red-500">{loginError}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 transition-colors"
          >
            Daxil ol
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 overflow-hidden">
            <Image src="/logo.png" alt="" width={44} height={44} className="object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Admin Panel</h1>
            <p className="text-xs text-slate-400">Bütün yüklənmiş fayllar</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
            <span>{stats.totalFiles} fayl</span>
            <span className="text-slate-300">&middot;</span>
            <span>{fmtBytes(stats.totalSize)}</span>
          </div>
          <button
            onClick={() => setShowPasswordChange(true)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <IconSettings className="w-3.5 h-3.5" />
            Şifrəni dəyiş
          </button>
          <button
            onClick={() => { sessionStorage.removeItem("adminPassword"); setAuthed(false); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition"
          >
            Çıxış
          </button>
        </div>
      </header>

      {listError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar onSearch={setQuery} placeholder="Bütün fayllar arasında axtar..." />
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
            <span>İstifadə olunan: {fmtBytes(storageInfo.used)} / {fmtBytes(storageInfo.total)}</span>
            <span>{storageInfo.user}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (storageInfo.used / storageInfo.total) * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Fayllar</h2>
        <span className="text-xs text-slate-400">{files.length} fayl</span>
      </div>
      <FileList
        files={files}
        loading={loading}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onView={handleView}
        onRename={handleRename}
        onShare={handleShare}
        onOpenFolder={handleOpenFolder}
        isAdmin={true}
        view={view}
        insideFolder={currentFolder && currentFolder !== rootFolderId}
        deletingKey={deleting ? deleteConfirm?.key : null}
      />

      {viewingFile && (
        <FileViewer
          file={viewingFile}
          onClose={() => setViewingFile(null)}
          onDownload={handleDownload}
        />
      )}

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

      {/* Deletion Progress Overlay */}
      {deleting && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Fayl silinir...</h3>
                <p className="text-xs text-slate-400">Sinxronizasiya davam edir</p>
              </div>
            </div>
            <div className="space-y-2">
              {deletionSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <div className="flex-shrink-0">
                    {step.status === "success" && <IconCheck className="w-4 h-4 text-emerald-500" />}
                    {step.status === "failed" && <IconX className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700">{STEP_LABELS[step.op] || step.op}</p>
                    {step.message && <p className="text-[10px] text-slate-400 truncate">{step.message}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Deletion Result Banner */}
      {deletionResult && !deleting && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border ${deletionResult === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            {deletionResult === "success"
              ? <IconCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              : <IconAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
            }
            <span className="text-sm font-medium">{deletionResult === "success" ? "Fayl tamamilə silindi — storage, database və linklər təmizləndi" : "Silinmə qismən uğursuz oldu — database qeydi qorundu"}</span>
            <button onClick={() => { setDeletionResult(null); setDeletionSteps([]); }} className="ml-2 p-1 rounded-full hover:bg-white/50 transition">
              <IconClose className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                <IconAlert className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Faylı sil</h3>
              <p className="text-xs text-slate-400 mt-1">Bu əməliyyat geri alınamaz</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 mb-4">
              <p className="text-xs text-amber-800 font-medium mb-1">Silinmə prosesi:</p>
              <ol className="text-[10px] text-amber-700 space-y-0.5 list-decimal list-inside">
                <li>Storage sistemindən fiziki nüsxə silinəcək</li>
                <li>Verilənlər bazasından qeyd silinəcək</li>
                <li>Paylaşım linkləri deaktiv ediləcək</li>
                <li>Bütün metadata qeydləri təmizlənəcək</li>
              </ol>
            </div>
            <p className="text-sm text-slate-600 mb-5 text-center">
              <span className="font-semibold text-slate-800">{deleteConfirm.name}</span> faylı silmək istədiyinizə əminsiniz?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition">
                Ləğv et
              </button>
              <button onClick={() => confirmDelete(deleteConfirm)} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition shadow-sm">
                Bəli, sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPasswordChange(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Şifrəni dəyiş</h3>
                <p className="text-xs text-slate-400 mt-0.5">Cari şifrəni daxil edin, sonra yenini yazın</p>
              </div>
              <button onClick={() => { setShowPasswordChange(false); setPwMsg(""); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <IconClose className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cari şifrə</label>
                <input
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  placeholder="••••"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Yeni şifrə</label>
                <input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="••••"
                  required
                  minLength={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
              </div>
              {pwMsg && (
                <p className={`text-xs px-1 ${pwMsg.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
                  {pwMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={pwLoading || !pwCurrent || !pwNew}
                className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {pwLoading ? "Dəyişdirilir..." : "Şifrəni dəyişdir"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
