# 🔒 Security Features

Forkcast follows standard practices to keep users and their data safe.

- **Password Hashing**: `bcryptjs` with salt rounds. Passwords are never stored in plaintext.
- **JWT Tokens**: Secure authentication with 7-day expiry. `JWT_SECRET` is server-only.
- **Input Validation**: Both client and server validate required fields, lengths, and types.
- **File Upload Security**: MIME type and size validation before forwarding to Cloudinary.
- **CORS Configuration**: `next.config.js` sets `Access-Control-Allow-*` headers from the `CORS_ORIGINS` env var.
- **Secret hygiene**:
  - `SUPABASE_SERVICE_ROLE_KEY` and `CLOUDINARY_API_SECRET` are server-only and must never appear in any file imported by a `'use client'` module.
  - `.env` is gitignored. Rotate any secret that has been committed by accident.
