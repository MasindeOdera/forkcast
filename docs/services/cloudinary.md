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

## 🆕 Creating the `Forkcast` upload preset

A "preset" on Cloudinary is a saved bundle of upload options (folder, allowed formats, max size, default transformations). Our app assumes one named `Forkcast` exists. If you're setting up a new Cloudinary account, create it like this:

1. Log into the Cloudinary console.
2. Go to **Settings** (gear icon, top right) → **Upload** → scroll to **Upload presets** → **Add upload preset**.
3. Configure:
   - **Preset name**: `Forkcast` (must match `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`).
   - **Signing mode**: **Signed**. This is important — we upload from the server with the API secret, so unsigned uploads would be an unnecessary risk.
   - **Folder**: `forkcast` (keeps all meal images in one place; makes cleanup and quota tracking easy).
   - **Allowed formats**: `jpg, png, gif, webp`.
   - **Max file size**: `10485760` (10 MB in bytes). Our server-side check also enforces this.
   - **Access mode**: `public` (URLs must be openly viewable so `<img>` tags work).
   - Optional but recommended: **Incoming transformation** → `Quality: auto`, `Format: auto`. This has Cloudinary re-encode on ingest for optimal size.
4. **Save**.
5. Update your `.env` if you used a different name and redeploy.

> If you rename the preset later, remember it lives in **two** places: the Cloudinary dashboard and the `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` env var. Both must match.

## Validation

Before forwarding to Cloudinary, the `/api/upload` route validates:
- **MIME type**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- **File size**: rejects anything above 10 MB

If either check fails, the client gets a `400` with an explanatory message.

## 🎨 Image transformations (serve the right size for the job)

One of Cloudinary's best features is that you don't need pre-generated thumbnails — you can transform any uploaded image on the fly by adding parameters to its URL.

A raw upload comes back as, roughly:

```
https://res.cloudinary.com/<cloud>/image/upload/v1712345678/forkcast/abc123.jpg
```

You add a **transformation segment** right after `/upload/`:

```
https://res.cloudinary.com/<cloud>/image/upload/w_400,h_300,c_fill,q_auto,f_auto/v1712345678/forkcast/abc123.jpg
                                              └─── transformation ───┘
```

### Useful params

| Param   | Meaning                                                              |
|---------|----------------------------------------------------------------------|
| `w_400` | Resize to width 400px                                                |
| `h_300` | Resize to height 300px                                               |
| `c_fill`| Fill mode: crop to exactly `w × h` (also try `c_scale`, `c_fit`)     |
| `q_auto`| Quality auto (Cloudinary picks optimal compression)                  |
| `f_auto`| Format auto (serves WebP/AVIF where the browser supports it)         |
| `g_auto`| Gravity auto — smart focal-point cropping                            |

### Suggested presets for Forkcast

| UI usage       | Suggested transformation                | Approx size |
|----------------|-----------------------------------------|-------------|
| Meal card thumb| `w_400,h_300,c_fill,g_auto,q_auto,f_auto` | ~30–80 KB |
| Meal detail hero | `w_1200,h_600,c_fill,g_auto,q_auto,f_auto` | ~120–300 KB |
| Avatar / small preview | `w_80,h_80,c_fill,g_face,q_auto,f_auto` | ~5–15 KB |

One-liner helper if you want to centralize this in code:

```js
// lib/cloudinary.js (idea, not shipped yet)
export function transform(url, params) {
  return url.replace('/upload/', `/upload/${params}/`)
}
// usage:
<img src={transform(meal.imageUrl, 'w_400,h_300,c_fill,q_auto,f_auto')} />
```

## 🧭 Common tasks in the Cloudinary dashboard

- **Browse uploaded images**: *Media Library* — filter by folder (`forkcast`).
- **Change size limits or allowed formats**: *Settings → Upload → Upload presets* → edit `Forkcast`.
- **Rotate credentials**: *Settings → API Keys* → generate a new key, update `.env`, redeploy.
- **Delete an image**: Media Library → select → delete. The DB will still reference the old URL — clean up the corresponding `meals.image_url` in Supabase.
