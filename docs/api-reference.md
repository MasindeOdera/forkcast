# 🔧 API Reference

All API routes are served by Next.js API routes under the `/api` prefix.

## Authentication

| Method | Endpoint             | Description                |
|--------|----------------------|----------------------------|
| POST   | `/api/auth/register` | User registration          |
| POST   | `/api/auth/login`    | User login                 |
| GET    | `/api/users/me`      | Get current user info      |

## Meals

| Method | Endpoint            | Description                                 |
|--------|---------------------|---------------------------------------------|
| GET    | `/api/meals`        | Get all meals (with optional filters)       |
| POST   | `/api/meals`        | Create new meal                             |
| GET    | `/api/meals/{id}`   | Get a specific meal                         |
| PUT    | `/api/meals/{id}`   | Update meal (owner only)                    |
| DELETE | `/api/meals/{id}`   | Delete meal (owner only)                    |

## File Upload

| Method | Endpoint      | Description                    |
|--------|---------------|--------------------------------|
| POST   | `/api/upload` | Upload an image to Cloudinary  |

## AI Features

| Method | Endpoint                  | Description                          |
|--------|---------------------------|--------------------------------------|
| POST   | `/api/meal-suggestions`   | Get AI-powered meal suggestions      |
