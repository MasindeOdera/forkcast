# 🔧 API Reference

All API routes are served by Next.js under the `/api` prefix and dispatched from a single catch-all handler at `app/api/[[...path]]/route.js`.

## Authentication

| Method | Endpoint             | Auth  | Description                |
|--------|----------------------|-------|----------------------------|
| POST   | `/api/auth/register` | –     | Create a new user          |
| POST   | `/api/auth/login`    | –     | Log in, returns JWT        |
| GET    | `/api/users/me`      | JWT   | Get current user info      |

Protected endpoints expect the JWT in an `Authorization: Bearer <token>` header.

## Meals

| Method | Endpoint            | Auth       | Description                                  |
|--------|---------------------|------------|----------------------------------------------|
| GET    | `/api/meals`        | –          | List meals (optional query params for search)|
| POST   | `/api/meals`        | JWT        | Create a new meal                            |
| GET    | `/api/meals/{id}`   | –          | Fetch a single meal                          |
| PUT    | `/api/meals/{id}`   | JWT, owner | Update a meal (only the creator)             |
| DELETE | `/api/meals/{id}`   | JWT, owner | Delete a meal (only the creator)             |

## File Upload

| Method | Endpoint      | Auth | Description                                  |
|--------|---------------|------|----------------------------------------------|
| POST   | `/api/upload` | JWT  | Upload an image to Cloudinary, returns URL   |

## AI Features

| Method | Endpoint                  | Auth | Description                          |
|--------|---------------------------|------|--------------------------------------|
| POST   | `/api/meal-suggestions`   | JWT  | Get AI-powered meal suggestions      |

## Operational

| Method | Endpoint      | Auth | Description                                              |
|--------|---------------|------|----------------------------------------------------------|
| GET    | `/api/health` | –    | Liveness + DB reachability probe. Used by the keepalive workflow. |

See [operations/debugging.md](../operations/debugging.md#-hitting-the-api-directly--end-to-end-sanity-check) for `curl` examples of these endpoints.
