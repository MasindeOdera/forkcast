# 🚀 Deployment

The app is currently deployed and accessible at the URL configured in `NEXT_PUBLIC_BASE_URL`.

For local or self-hosted deployment:

1. Ensure all environment variables (see [Getting Started](./getting-started.md)) are properly configured.
2. Ensure MongoDB is reachable via `MONGO_URL`.
3. Build and start the app, or run it under a process manager such as `supervisor`.

```bash
yarn build
yarn start
```
