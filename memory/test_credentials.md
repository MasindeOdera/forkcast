# Test Credentials for Forkcast

## ⚠️ Local Environment Note

The `/app/.env` file is intentionally absent in this preview container. The
app is production-deployed via secrets manager and works there. Locally,
`GET /api/meals` will return HTTP 500 with the error message
"Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL /
SUPABASE_SERVICE_ROLE_KEY)". **This is expected** and is exactly what
triggers the new "We couldn't load your meals" error state UI.

## How to bypass the AuthForm for UI testing

There is NO seed script and no local DB. To test the logged-in UI states
(Discover / My Meals / Plan tabs, meal form dialog, confirm dialog,
skeleton loaders, error states, etc.), inject a fake user/token into
localStorage before navigating:

```js
localStorage.setItem('forkcast_token', 'fake.jwt.token');
localStorage.setItem('forkcast_user', JSON.stringify({
  id: 'fake-user-id',
  username: 'test_user',
}));
// Then reload the page
location.reload();
```

The `/api/meals` calls will fail with 500, which produces the
**first-load error state** (big red card with "Try again" button) —
this is one of the flows we specifically need to verify.

## Testing the SESSION_EXPIRED flow

To force a 401 response, use a syntactically-valid-looking token that the
JWT verify will reject:

```js
localStorage.setItem('forkcast_token', 'eyJhbGciOi.bad.token');
localStorage.setItem('forkcast_user', JSON.stringify({
  id: 'fake', username: 'test_user'
}));
location.reload();
```

Expected: toast "Your session has expired. Please log in again." appears,
localStorage is cleared, user is dropped back to the AuthForm.

## Testing the offline banner

Playwright: `await context.set_offline(True)` — a red sticky banner should
appear at the top of the page with "You're offline. Some features may not
work…". Turn back with `set_offline(False)` and the banner vanishes.

## Real credentials

None available in this environment. The production deploy at
`https://forkcast-six.vercel.app` has real users but those credentials
are the user's own and are not shared with the testing environment.
