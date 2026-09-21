"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Dropzone from "./components/Dropzone";
import SearchBar from "./components/SearchBar";
import FileList from "./components/FileList";
import FileViewer from "./components/FileViewer";

function uploadViaProxy(url, file, onProgress) {
  // Ehtiyat yol: fayl server proxy ilə Hot4Share-ə yüklənir
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
    xhr.send(body);
  });
}

async function uploadDirectToShare(file, onProgress) {
  // 1) Upload URL + sessiya al
  const initRes = await fetch("/api/upload/init", { cache: "no-store" });
  if (!initRes.ok) {
    const errData = await initRes.json().catch(() => ({}));
    throw new Error(errData.error || "Upload serveri hazırlanmadı");
  }
  const init = await initRes.json().catch(() => ({}));
  if (!init.url || !init.sessId) throw new Error("Upload serveri hazırlanmadı");

  // 2) Faylı birbaşa Hot4Share-ə yüklə (CORS dəstəyi var, serverless limitləri keçilir)
  const body = new FormData();
  body.append("sess_id", init.sessId);
  body.append("utype", "prem");
  body.append("file_0_descr", file.name);
  body.append("file_0", file, file.name);
  const target = `${init.url}?upload_type=file&sess_id=${encodeURIComponent(init.sessId)}&utype=prem`;

  const text = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", target, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new Error(`Yükləmə serveri xəta qaytardı (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Birbaşa yükləmə mümkün olmadı"));
    xhr.send(body);
  });

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Upload cavabı oxuna bilmədi");
  }
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || first.file_status !== "OK" || !first.file_code) {
    throw new Error(first?.file_status || "Yükləmə rədd edildi");
  }
  return first.file_code;
}

async function registerUpload(file, fileCode) {
  const res = await fetch("/api/files/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileCode,
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Metadata qeydə alınmadı");
  return data.file;
}

export default function UserPanel() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [uploads, setUploads] = useState([]);
  const [viewingFile, setViewingFile] = useState(null);

  const loadFiles = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    const t = setTimeout(() => loadFiles(query), 300);
    return () => clearTimeout(t);
  }, [query, loadFiles]);

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
      const updateProgress = (progress) =>
        setUploads((prev) =>
          prev.map((u) => (u.id === job.id ? { ...u, progress } : u))
        );

      try {
        let fileCode = null;
        try {
          fileCode = await uploadDirectToShare(job.file, updateProgress);
        } catch (directErr) {
          // CORS/şəbəkə məhdudiyyəti olan mühitlərdə server proxy-yə keç
          await uploadViaProxy("/api/files", job.file, updateProgress);
        }
        if (fileCode) {
          await registerUpload(job.file, fileCode);
        }

        setUploads((prev) => prev.filter((u) => u.id !== job.id));
        loadFiles(query);
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) => (u.id === job.id ? { ...u, error: err.message, progress: 0 } : u))
        );
      }
    }
  }

  async function handleDownload(file) {
    const encodedKey = encodeURIComponent(file.key);
    const url = file.url || `/api/files/${encodedKey}`;
    window.open(url, "_blank");
  }

  function handleView(file) {
    setViewingFile(file);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col items-center gap-4 text-center">
        {/* Logo */}
        <div className="relative">
          <Image
            src="/logo.png"
            alt="Fayl Meneceri"
            width={72}
            height={72}
            className="rounded-2xl shadow-lg shadow-indigo-200/50 object-contain"
            priority
          />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">Fayl Meneceri</h1>
          <p className="max-w-md text-sm text-slate-500 mt-1">
            Faylınızı yükləyin, saxlayın və istənilən vaxt geri əldə edin. Qeydiyyat lazım deyil.
          </p>
        </div>
      </header>

      <div className="mb-8 flex justify-center">
        <SearchBar
          onSearch={setQuery}
          placeholder="Fayl adı ilə axtar..."
          onAdminTrigger={() => { sessionStorage.setItem("adminAutoLogin", "1"); window.location.href = "/admin"; }}
        />
      </div>

      <section className="mb-8">
        <Dropzone onFilesSelected={handleFilesSelected} />
      </section>

      {uploads.length > 0 && (
        <section className="mb-8 space-y-2">
          {uploads.map((u) => (
            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate font-medium text-slate-600">{u.name}</span>
                <span className={u.error ? "text-red-500" : "text-slate-400"}>
                  {u.error ? "Xəta: " + u.error : `${u.progress}%`}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    u.error ? "bg-red-400" : "bg-indigo-500"
                  }`}
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Fayllar</h2>
          {!loading && (
            <span className="text-xs text-slate-400">{files.length} fayl</span>
          )}
        </div>
        <FileList files={files} loading={loading} onDownload={handleDownload} onView={handleView} />
      </section>

      {viewingFile && (
        <FileViewer
          file={viewingFile}
          onClose={() => setViewingFile(null)}
          onDownload={handleDownload}
        />
      )}
    </main>
  );
}
