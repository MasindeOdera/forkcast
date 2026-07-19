# 🖼️ Cloudinary (Image Uploads)

**Cloudinary** is a managed image hosting & transformation CDN. We use it to store meal photos and serve them optimized (resized, compressed, WebP where supported) to browsers.

## Why Cloudinary?

Storing binary image data in the database would be slow and expensive. Cloudinary gives us:

- A dedicated CDN for delivering images fast, globally.
- On-the-fly transformations (crop, resize, format conversion) via URL parameters — no server work needed.
- A free tier that covers a demo-scale app comfortably.

## The upload flow

```
[Browser]  ──(1) select file──▶  [MealForm / ImageUpload component]
     │
     ▼
[POST /api/upload]  ──(2) multipart body──▶  [Next.js API route]
     │
     ▼
[Cloudinary API]  ◀──(3) upload w/ API secret──┘
     │
     ▼
[Cloudinary returns secure_url]  ──(4)──▶  [DB row: meals.image_url = secure_url]
```

1. User picks a file in the browser.
2. Frontend `POST`s a `multipart/form-data` body to `/api/upload`.
3. Server route (see `app/api/[[...path]]/route.js`) uses `cloudinary` npm package with the **API secret** to upload the file. The secret **never** leaves the server.
4. Cloudinary returns a `secure_url`; we persist that URL on the `meals` row as `image_url`.

## Env vars

| Variable                              | Where it lives         | Purpose                              |
|---------------------------------------|------------------------|--------------------------------------|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`   | Browser + server       | Identifies the Cloudinary account    |
| `CLOUDINARY_API_KEY`                  | Server only            | Auth for upload API                  |
| `CLOUDINARY_API_SECRET`               | Server only ⚠️         | Signs upload requests; **must** stay secret |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`| Browser + server       | Cloudinary preset that defines allowed folder, transformations, size limits |

## Validation

Before forwarding to Cloudinary, the `/api/upload` route validates:
- **MIME type**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- **File size**: rejects anything above 10 MB

If either check fails, the client gets a `400` with an explanatory message.

## 🧭 Common tasks in the Cloudinary dashboard

- **Browse uploaded images**: *Media Library* — filter by folder (`Forkcast`).
- **Change size limits or allowed formats**: *Settings → Upload → Upload presets* → edit `Forkcast`.
- **Rotate credentials**: *Settings → API Keys* → generate a new key, update `.env`, redeploy.
- **Delete an image**: Media Library → select → delete. The DB will still reference the old URL — clean up the corresponding `meals.image_url` in Supabase.
