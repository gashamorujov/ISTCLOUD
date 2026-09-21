import {
  db,
  ref,
  set,
  get,
  remove,
  update,
  push,
} from "./firebase";
import { getFile } from "./google-drive";

const FILES_PATH = "files";
const SHARE_LINKS_PATH = "shareLinks";

// ─── FILE METADATA (Google Drive fileId açarı ilə) ─────────

export async function saveFileMetadata({ key, name, originalName, size, contentType, storageUrl, folderId, lastModified }) {
  const fileId = key;
  const fileData = {
    id: fileId,
    file_id: fileId,
    name,
    original_name: originalName || name,
    size: size || 0,
    content_type: contentType || "application/octet-stream",
    storage_url: storageUrl || `/api/files/${encodeURIComponent(fileId)}`,
    folder_id: folderId || null,
    last_modified: lastModified || new Date().toISOString(),
    created_at: Date.now(),
    deleted_at: null,
    deleted_by: null,
  };
  try {
    await set(ref(db, `${FILES_PATH}/${fileId}`), fileData);
  } catch {
    // Metadata cache best-effort-dir; əsas nüsxə Google Drive-dadır
  }
  return fileData;
}

export async function updateFileMetadata(fileId, patch) {
  try {
    await update(ref(db, `${FILES_PATH}/${fileId}`), { ...patch, updated_at: Date.now() });
  } catch {
    // best-effort
  }
}

export async function getFileById(fileId) {
  try {
    const snapshot = await get(ref(db, `${FILES_PATH}/${fileId}`));
    if (snapshot.exists() && !snapshot.val().deleted_at) {
      return { ...snapshot.val(), id: fileId };
    }
  } catch {
    return null;
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

// ─── ATOMIC DELETE ────────────────────────────────────────
//
// 1. Faylın məlumatlarını yoxla (DB + Drive)
// 2. Google Drive-dan sil (fiziki nüsxə)
// 3. DB qeydini sil + paylaşım linklərini deaktiv et
// 4. Nəticə addımlarını qaytar (UI yeniləmə üçün)

export async function atomicDelete(fileId, storageDeleteFn) {
  const steps = [];

  let meta = null;
  let remote = null;
  try {
    meta = await getFileById(fileId);
  } catch {
    meta = null;
  }
  try {
    remote = await getFile(fileId);
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
    id: fileId,
    file_id: fileId,
    name: remote?.name || fileId,
    size: Number(remote?.size) || 0,
  };
  steps.push({ op: "check", status: "success", message: "Fayl tapıldı, silinmə üçün qeyd olundu" });

  // 2. Google Drive-dan sil
  try {
    await storageDeleteFn(fileId);
    steps.push({ op: "storage_delete", status: "success", message: "Google Drive-dan fayl silindi" });
  } catch (err) {
    steps.push({ op: "storage_delete", status: "failed", message: err.message || "Storage silinməsi uğursuz" });
    return {
      success: false,
      steps,
      file,
      error: "Google Drive silinməsi uğursuz oldu. Database qeydi qorundu.",
    };
  }

  // 3. DB qeydini sil + paylaşım linklərini deaktiv et
  try {
    await remove(ref(db, `${FILES_PATH}/${fileId}`));
    try {
      const linksSnap = await get(ref(db, SHARE_LINKS_PATH));
      if (linksSnap.exists()) {
        const links = linksSnap.val();
        const updates = {};
        for (const [linkId, link] of Object.entries(links)) {
          if ((link.file_id === fileId || link.file_id === file?.id) && !link.revoked_at) {
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
    steps.push({ op: "db_cleanup", status: "success", message: "Backend qeydləri tam silindi" });
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
  const linkRef = push(ref(db, SHARE_LINKS_PATH));
  await set(linkRef, {
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
      const merged = { ...link, file: { id: link.file_id, file_id: link.file_id } };
      return merged;
    }
  }
  return null;
}
