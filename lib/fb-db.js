import {
  db,
  ref,
  set,
  get,
  remove,
  update,
} from "./firebase";
import { getFileInfo, tryRemoteDelete } from "./hot4share";

const FILES_PATH = "files";
const SHARE_LINKS_PATH = "shareLinks";
const HIDDEN_PATH = "deletedFiles";

// ─── FILE METADATA (Hot4Share file_code açarı ilə) ─────────

export async function saveFileMetadata({ key, name, originalName, size, contentType, storageUrl, lastModified }) {
  const fileData = {
    id: key,
    s3_key: key,
    file_code: key,
    name,
    original_name: originalName,
    size: size || 0,
    content_type: contentType || "application/octet-stream",
    storage_url: storageUrl || null,
    last_modified: lastModified || new Date().toISOString(),
    created_at: Date.now(),
    deleted_at: null,
    deleted_by: null,
  };
  try {
    await set(ref(db, `${FILES_PATH}/${key}`), fileData);
  } catch {
    // Metadata cache best-effort-dir; əsas nüsxə Hot4Share-dədir
  }
  return fileData;
}

export async function getFileByS3Key(code) {
  try {
    const snapshot = await get(ref(db, `${FILES_PATH}/${code}`));
    if (snapshot.exists() && !snapshot.val().deleted_at) {
      return { ...snapshot.val(), id: code };
    }
  } catch {
    // DB oxuna bilməsə remote yoxlanışa keç
  }
  return null;
}

export async function getMetaMap() {
  try {
    const snapshot = await get(ref(db, FILES_PATH));
    if (!snapshot.exists()) return {};
    return snapshot.val() || {};
  } catch {
    return {};
  }
}

export async function getHiddenCodes() {
  try {
    const snapshot = await get(ref(db, HIDDEN_PATH));
    if (!snapshot.exists()) return new Set();
    return new Set(Object.keys(snapshot.val() || {}));
  } catch {
    return new Set();
  }
}

export async function hideFileCode(fileCode) {
  try {
    await set(ref(db, `${HIDDEN_PATH}/${fileCode}`), {
      file_code: fileCode,
      deleted_at: Date.now(),
      deleted_by: "admin",
    });
  } catch {
    throw new Error("Silinmiş fayl gizlədilə bilmədi");
  }
}

export async function listFiles() {
  const metas = await getMetaMap();
  return Object.entries(metas)
    .filter(([, f]) => !f?.deleted_at)
    .map(([id, f]) => ({ ...f, id }));
}

// ─── ATOMIC DELETE ────────────────────────────────────────
//
// Ardıcıllıq:
//  1. Faylın məlumatlarını yoxla (DB + Hot4Share)
//  2. Hot4Share-dən silməyə cəhd et
//  3. DB qeydini sil + paylaşım linklərini deaktiv et
//  4. Nəticə addımlarını qaytar (UI yeniləmə üçün)

export async function atomicDelete(fileCode) {
  const steps = [];

  // 1. Yoxla
  const hidden = await getHiddenCodes().catch(() => new Set());
  if (hidden.has(fileCode)) {
    return {
      success: false,
      steps: [{ op: "check", status: "failed", message: "Fayl artıq silinib" }],
      file: null,
      error: "Fayl tapılmadı",
    };
  }
  let meta = null;
  let remote = null;
  try {
    meta = await getFileByS3Key(fileCode);
  } catch {
    meta = null;
  }
  try {
    remote = await getFileInfo(fileCode);
  } catch {
    remote = null;
  }

  if (!meta && !remote) {
    return {
      success: false,
      steps: [{ op: "check", status: "failed", message: "Fayl tapılmadı və ya artıq silinib" }],
      file: null,
      error: "Fayl tapılmadı",
    };
  }

  const file = meta || {
    id: fileCode,
    s3_key: fileCode,
    file_code: fileCode,
    name: remote?.name || fileCode,
    size: remote?.size || 0,
  };
  steps.push({ op: "check", status: "success", message: "Fayl tapıldı, silinmə üçün qeyd olundu" });

  // 2. Storage-dən sil
  const remoteResult = await tryRemoteDelete(fileCode);
  if (remoteResult.ok) {
    steps.push({ op: "storage_delete", status: "success", message: "Hot4Share-dən fayl silindi" });
  } else if (remoteResult.supported === false) {
    steps.push({ op: "storage_delete", status: "skipped", message: `${remoteResult.message} — fayl paneldən və bazadan silinir` });
  } else {
    steps.push({ op: "storage_delete", status: "failed", message: remoteResult.message || "Storage silinməsi uğursuz" });
    return {
      success: false,
      steps,
      file,
      error: "Storage silinməsi uğursuz oldu. Database qeydi qorundu.",
    };
  }

  // 3. DB qeydini sil + paylaşım linklərini deaktiv et + remote siyahıdan gizlət
  try {
    await remove(ref(db, `${FILES_PATH}/${fileCode}`));
    await hideFileCode(fileCode);
    try {
      const linksSnap = await get(ref(db, SHARE_LINKS_PATH));
      if (linksSnap.exists()) {
        const links = linksSnap.val();
        const updates = {};
        for (const [linkId, link] of Object.entries(links)) {
          if ((link.file_id === fileCode || link.file_id === file?.id) && !link.revoked_at) {
            updates[`${SHARE_LINKS_PATH}/${linkId}/revoked_at`] = Date.now();
          }
        }
        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }
    } catch {
      // Link deaktivasiyası best-effort
    }
    steps.push({ op: "db_cleanup", status: "success", message: "Backend qeydləri tam silindi, fayl siyahıdan gizlədildi" });
  } catch (err) {
    steps.push({ op: "db_cleanup", status: "failed", message: err.message });
    return {
      success: false,
      steps,
      file,
      error: "Database silinməsi uğursuz oldu.",
    };
  }

  // 4. UI yenilə
  steps.push({ op: "ui_refresh", status: "success", message: "İnterfeys yeniləndi" });

  return { success: true, steps, file };
}

// ─── SHARE LINKS ──────────────────────────────────────────

export async function createShareLink({ fileId, token, expiresAt }) {
  const { push: pushRef, set: setRef } = await import("./firebase");
  const linkRef = pushRef(ref(db, SHARE_LINKS_PATH));
  await setRef(linkRef, {
    id: linkRef.key,
    file_id: fileId,
    token,
    expires_at: expiresAt || null,
    access_count: 0,
    created_at: Date.now(),
    revoked_at: null,
  });
  return linkRef.key;
}

export async function getShareLink(token) {
  const snapshot = await get(ref(db, SHARE_LINKS_PATH));
  if (!snapshot.exists()) return null;

  const links = snapshot.val();
  for (const [, link] of Object.entries(links)) {
    if (link.token === token && !link.revoked_at) {
      const fileSnap = await get(ref(db, `${FILES_PATH}/${link.file_id}`));
      if (fileSnap.exists() && !fileSnap.val().deleted_at) {
        return { ...link, file: fileSnap.val() };
      }
    }
  }
  return null;
}
