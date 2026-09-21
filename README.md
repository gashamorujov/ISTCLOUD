# ISTCLOUD — Fayl Meneceri

Next.js + Tailwind CSS ilə qurulmuş tam funksional cloud storage fayl meneceri.
Əsas storage olaraq Google Drive istifadə olunur, metadata Firebase Realtime Database-də saxlanılır.

## Xüsusiyyətlər

- **User Panel** — qeydiyyatsız açıq: qovluq navigasiyası, axtarış, drag & drop, yükləmə, baxış, endirmə, rename, paylaşma linki, grid/list görünüşü, çeşidləmə
- **Admin Panel** — axtarış sahəsinə `1006` yazdıqda açılır (əlavə şifrə tələb olunmur)
- Admin parolu: `0706` (Admin Paneldən dəyişdirmək mümkündür)
- Fayl əməliyyatları: yükləmə, endirmə, baxış, silmə, ad dəyişdirmə, paylaşma linki
- Qovluq sistemi: qovluq yaratma, qovluğa daxil olma, geri çıxma
- Google Drive-a birbaşa brauzer serveri vasitəsilə qoşulur (API key təhlükəsiz server-side); browser API key-ləri Drive yazma əməliyyatlarını dəstəkləmir
- Fayl silmə: Google Drive + database + linklər birlikdə təmizlənir
- Video/şəkil preview, Range dəstəyi ilə streaming
- Böyük fayllar üçün resumable upload (>5MB)
- Mobil və masaüstü üçün tam responsiv, grid/list toggle

## Yerli Quraşdırma

```bash
npm install
cp .env.example .env.local
# .env.local faylında Google Drive Service Account təyin edin
npm run dev
```

Sayt: `http://localhost:3000`

## Google Drive API-nin Aktivləşdirilməsi

1. Google Cloud Console (https://console.cloud.google.com) daxil olun.
2. Yeni layihə yaradın (və ya mövcud layihə seçin).
3. **APIs & Services → Library** bölməsində "Google Drive API" axtarın və aktiv edin.
4. **APIs & Services → Credentials** bölməsində:
   - **Create Credentials → Service Account** seçin
   - Hesab adı verin (məsələn: `istcloud-drive`)
   - Oluşdurduqdan sonra service account-a keçin
   - **Keys → Add Key → Create new key → JSON** seçin
   - JSON faylı endirin
5. JSON faylını base64-ə çevirin:
   ```bash
   base64 -w 0 your-service-account.json
   ```
6. Əldə etdiyiniz base64 dəyərini `.env.local` faylındakı `GOOGLE_DRIVE_SERVICE_ACCOUNT` dəyərinə yazın.
7. Google Drive-da service account e-poçtunu qovluğa əlavə edin (Paylaş → Əlavə et):
   - Service account e-poçtu JSON faylında `client_email` sahəsində görünür
   - İstənilən başlanğıc qovluq (və ya `CloudStorage` qovluğunu avtomatik yaratmaq üçün root) ilə paylaşın

**Vacib:** Google Drive-də API key-lər Drive yazma əməliyyatlarını dəstəkləmir — OAuth 2.0 / Service Account istifadə olunmalıdır. Tətbiq bu məntiqlə qurulub.

## Deploy

1. Reponu platformaya import edin (Vercel/Netlify/Node.js host).
2. Environment dəyişənlərini təyin edin:
   - `GOOGLE_DRIVE_SERVICE_ACCOUNT` — base64-encoded service account JSON (əsas)
   - `GOOGLE_DRIVE_CLIENT_EMAIL` + `GOOGLE_DRIVE_PRIVATE_KEY` — alternativ (əgər Service Account istifadə etmirsinizsə)
   - `GOOGLE_DRIVE_ROOT_FOLDER_ID` — boş buraxılsa, "CloudStorage" qovluğu avtomatik yaradılır
   - `ADMIN_PASSWORD` — admin parolu (standart: `0706`)
3. Build əmri: `npm run build` · Start əmri: `npm run start`

## API Endpoint-ləri

- `GET /api/files?folder=&q=&sort=` — fayl/qovluq siyahısı + axtarış + çeşidləmə
- `POST /api/files` — multipart upload (server → Google Drive, resumable >5MB)
- `GET /api/files/<id>` — faylı stream edin (Range dəstəyi, permanent proxy)
- `DELETE /api/files/<id>` — atomik silmə (Drive + DB + linklər)
- `PATCH /api/files/<id>` — fayl/qovluq adını dəyişmə
- `POST /api/folders` — qovluq yaratma
- `GET /api/storage` — Google Drive storage haqqında məlumat
- `POST /api/share` — paylaşma linki yaratma
- `GET /api/share/<token>` — paylaşma linki ilə faylı yükləmə (permanent, server proxy)

## Struktur

- `lib/google-drive.js` — Google Drive API v3 client (Service Account JWT, resumable upload, streaming)
- `lib/fb-db.js` — Firebase metadata + atomik silmə + paylaşma linkləri
- `app/api/files/` — CRUD endpoint-ləri
- `app/api/folders/` — qovluq yaratma
- `app/api/storage/` — Drive storage info
- `app/api/share/` — paylaşma linkləri
- `app/page.js` — User Panel (cloud storage interfeysi)
- `app/admin/page.js` — Admin Panel (idarəetmə)
