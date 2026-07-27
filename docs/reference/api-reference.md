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
| POST   | `/api/meal-suggestions`   | JWT  | Get AI-powered meal suggestions. Pass `{ usePantry: true }` to include the user's non-expired pantry items in the ingredient list. |

## Kitchen (Pantry + Shopping List)

Added by the Kitchen feature. All routes require JWT auth and are scoped by the caller's `userId`.

| Method | Endpoint                              | Description                                            |
|--------|---------------------------------------|--------------------------------------------------------|
| GET    | `/api/pantry`                         | List the user's pantry items                           |
| POST   | `/api/pantry`                         | Add an item `{ name, barcode?, quantity?, unit?, expiresAt? }` |
| PUT    | `/api/pantry/{id}`                    | Update fields on a pantry item                         |
| DELETE | `/api/pantry/{id}`                    | Remove a pantry item                                   |
| GET    | `/api/shopping-list`                  | List the shopping list (unchecked-first)               |
| POST   | `/api/shopping-list`                  | Add a manual item `{ name, sourceMealId? }`            |
| POST   | `/api/shopping-list/generate`         | Regenerate items from planned meals `{ startDate, endDate }` (ISO). Dedupe is case-insensitive. |
| PUT    | `/api/shopping-list/{id}`             | Toggle checked / rename                                |
| DELETE | `/api/shopping-list/{id}`             | Remove one item                                        |
| DELETE | `/api/shopping-list?checked=true`     | Clear all checked items in one call                    |
| GET    | `/api/barcode-lookup?code={barcode}`  | Server-side Open Food Facts proxy. Returns `{ found, name, brand, image, quantity }`. Never throws \u2014 on failure returns `{ found: false }` so clients can fall back to manual entry. |

## Operational

| Method | Endpoint      | Auth | Description                                              |
|--------|---------------|------|----------------------------------------------------------|
| GET    | `/api/health` | –    | Liveness + DB reachability probe. Used by the keepalive workflow. |

See [operations/debugging.md](../operations/debugging.md#-hitting-the-api-directly--end-to-end-sanity-check) for `curl` examples of these endpoints.
