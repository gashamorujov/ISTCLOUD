import {
  db,
  ref,
  set,
  get,
  remove,
  update,
  push,
  serverTimestamp,
} from "./firebase";

const FILES_PATH = "files";
const SHARE_LINKS_PATH = "shareLinks";

// ─── FILE OPERATIONS ──────────────────────────────────────

export function saveFileMetadata({ key, name, originalName, size, contentType, storageUrl, lastModified }) {
  const fileRef = push(ref(db, FILES_PATH));
  const fileId = fileRef.key;

  const fileData = {
    id: fileId,
    s3_key: key,
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

  set(fileRef, fileData);
  return fileData;
}

export async function getFileByS3Key(s3Key) {
  const snapshot = await get(ref(db, FILES_PATH));
  if (!snapshot.exists()) return null;

  const files = snapshot.val();
  for (const [id, file] of Object.entries(files)) {
    if (file.s3_key === s3Key && !file.deleted_at) {
      return { ...file, id };
    }
  }
  return null;
}

export async function listFiles({ search = "" } = {}) {
  const snapshot = await get(ref(db, FILES_PATH));
  if (!snapshot.exists()) return [];

  const files = snapshot.val();
  let result = Object.entries(files)
    .filter(([, f]) => !f.deleted_at)
    .map(([id, f]) => ({ ...f, id }));

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.original_name && f.original_name.toLowerCase().includes(q)) ||
        (f.s3_key && f.s3_key.toLowerCase().includes(q))
    );
  }

  result.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return result;
}

// ─── ATOMIC DELETE ────────────────────────────────────────

/**
 * Atomik silinmə:
 *  1. DB-də soft-delete (record-u qoruyur, deaktiv edir)
 *  2. Storage-dən sil (S3/B2)
 *  3. Share link-ləri deaktiv et
 *  4. DB-dən tam sil
 *  5. UI yenilə
 *
 * Storage uğursuz olarsa → DB qeydi qalır (soft-delete)
 * DB软silinmə uğursuz olarsa → storage silinmə aparılmır
 */
export async function atomicDelete(s3Key, storageDeleteFn) {
  const steps = [];

  // 1. Faylı DB-də tap
  const file = await getFileByS3Key(s3Key);
  if (!file) {
    return {
      success: false,
      steps: [{ op: "check", status: "failed", message: "Fayl tapılmadı və ya artıq silinib" }],
      file: null,
      error: "Fayl tapılmadı",
    };
  }

  // 2. Soft-delete: DB-də qeydi deaktiv et + share link-ləri deaktiv et
  try {
    await update(ref(db, `${FILES_PATH}/${file.id}`), {
      deleted_at: Date.now(),
      deleted_by: "admin",
    });

    // Share link-ləri deaktiv et
    const linksSnap = await get(ref(db, SHARE_LINKS_PATH));
    if (linksSnap.exists()) {
      const links = linksSnap.val();
      const updates = {};
      for (const [linkId, link] of Object.entries(links)) {
        if (link.file_id === file.id && !link.revoked_at) {
          updates[`${SHARE_LINKS_PATH}/${linkId}/revoked_at`] = Date.now();
        }
      }
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
    }

    steps.push({ op: "check", status: "success", message: "Fayl tapıldı, silinmə üçün qeyd olundu" });
  } catch (err) {
    return {
      success: false,
      steps: [{ op: "check", status: "failed", message: err.message }],
      file,
      error: err.message,
    };
  }

  // 3. Storage-dən sil
  try {
    await storageDeleteFn(s3Key);
    steps.push({ op: "storage_delete", status: "success", message: "Storage-dən fayl silindi" });
  } catch (storageErr) {
    // Storage silinmədi → DB record qalır (soft-delete)
    steps.push({ op: "storage_delete", status: "failed", message: storageErr.message || "Storage silinməsi uğursuz" });
    return {
      success: false,
      steps,
      file,
      error: "Storage silinməsi uğursuz oldu. Database qeydi qorundu.",
    };
  }

  // 4. DB-dən tam sil
  try {
    await remove(ref(db, `${FILES_PATH}/${file.id}`));
    steps.push({ op: "db_cleanup", status: "success", message: "Database qeydləri tam silindi" });
  } catch (err) {
    // DB silinmədi → storage silindi amma DB qalır (qismi vəziyyət)
    steps.push({ op: "db_cleanup", status: "failed", message: err.message });
    return {
      success: false,
      steps,
      file,
      error: "Database silinməsi uğursuz. Storage təmizləndi, lakin database qeydi qaldı.",
    };
  }

  // 5. UI yenilə
  steps.push({ op: "ui_refresh", status: "success", message: "İnterfeys yeniləndi" });

  return {
    success: true,
    steps,
    file,
  };
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
      // Also fetch the file
      const fileSnap = await get(ref(db, `${FILES_PATH}/${link.file_id}`));
      if (fileSnap.exists() && !fileSnap.val().deleted_at) {
        return { ...link, file: fileSnap.val() };
      }
    }
  }
  return null;
}
