# ISTCLOUD — Fayl Meneceri

Next.js + Tailwind CSS ilə qurulmuş tam funksional fayl meneceri. Fayllar
Hot4Share API üzərindən idarə olunur, metadata Firebase Realtime Database-də
saxlanılır.

## Xüsusiyyətlər

- **User Panel** — qeydiyyatsız açıq: axtarış, drag & drop, fayl yükləmə, baxış, endirmə
- **Admin Panel** — axtarış sahəsinə `1006` yazdıqda açılır (əlavə şifrə tələb olunmur)
- Admin parolu: `0706` (Admin Paneldən dəyişdirmək mümkündür)
- Fayl silinməsi: backend + metadata + linklər təmizlənir, addım-addım status göstərilir
- Yükləmə birbaşa brauzerdən Hot4Share-ə edilir (serverless limitlərindən təsirlənmir), server proxy ehtiyat yoldur
- Tam responsiv, mobil və masaüstü üçün optimallaşdırılmışdır

## Yerli Quraşdırma

```bash
npm install
cp .env.example .env.local
# .env.local içində HOT4SHARE_API_KEY və ADMIN_PASSWORD-ü təyin edin
npm run dev
```

Sayt: `http://localhost:3000`

## Deploy (Vercel, Netlify, hər hansı Node.js host)

1. Reponu platformaya import edin.
2. Aşağıdakı environment dəyişənlərini təyin edin:
   - `HOT4SHARE_API_KEY` — Hot4Share API açarı
   - `ADMIN_PASSWORD` — admin parolu (standart: `0706`)
3. Build əmri: `npm run build` · Start əmri: `npm run start`

Yükləmə brauzerdən Hot4Share-ə birbaşa getdiyi üçün Vercel-in 4.5 MB-lıq
request limiti tətbiq olunmur — böyük video/sənəd faylları da işləyir.

## API Endpoint-ləri

- `GET /api/files?q=...` — fayl siyahısı + axtarış
- `POST /api/files` — server proxy ilə yükləmə (ehtiyat yol)
- `GET /api/upload/init` — birbaşa yükləmə üçün upload URL + sessiya
- `POST /api/files/register` — birbaşa yüklənmış faylın metadata qeydiyyatı
- `GET /api/files/<code>` — daimi baxış/endirmə keçidi (təzə direct link, müddəti bitmir)
- `DELETE /api/files/<code>` — atomik silmə (storage + DB + linklər)

## Qeydlər

- Hot4Share API silmə əməliyyatını dəstəkləmir: silinən fayl paneldən və
  backend-dən tam silinir və siyahıda görünmür; fiziki nüsxə Hot4Share hesabında
  qala bilər (statusu adminə göstərilir).
