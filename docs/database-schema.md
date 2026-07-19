# 🗄️ Database Schema

Forkcast uses MongoDB with two primary collections.

## Users Collection

```javascript
{
  id: "uuid",
  username: "string",
  password: "hashed_string",
  createdAt: "date"
}
```

## Meals Collection

```javascript
{
  id: "uuid",
  userId: "uuid",
  title: "string",
  ingredients: "string",
  instructions: "string",
  imageUrl: "string|null",
  createdAt: "date",
  updatedAt: "date"
}
```

## Notes

- All primary keys use UUIDs (not Mongo `ObjectId`) so documents are trivially JSON-serializable.
- `userId` on a meal document is a foreign reference to `users.id`.
- `imageUrl`, when present, points to a Cloudinary-hosted image.
