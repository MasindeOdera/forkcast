# 🤖 Emergent LLM (AI Suggestions)

The **AI Ideas** tab uses an LLM to generate meal suggestions based on the user's prompt and preferences. We access the model through the **Emergent LLM key**, an OpenAI-compatible API gateway.

## Why Emergent LLM?

- **One key, multiple providers**: works with OpenAI, Anthropic, and Google models behind a single credential.
- **OpenAI-compatible**: any HTTP client that speaks the OpenAI chat-completions format works out of the box.
- **Budget & usage tracking**: usage is metered against the same key, so we don't need per-provider billing setup.

## How it's wired up

- **Endpoint**: `POST /api/meal-suggestions` (routed inside `app/api/[[...path]]/route.js`).
- **Called from**: [`components/MealSuggestions.js`](../../components/MealSuggestions.js).
- **Env var**: `EMERGENT_LLM_KEY` — **server-only**, never expose to the browser.

High-level request lifecycle:

```
[MealSuggestions.js]  ──▶  POST /api/meal-suggestions  ──▶  [server route]
                                                                 │
                                              build prompt from  │
                                              user input +       │
                                              preferences        ▼
                                                       [Emergent LLM API]
                                                                 │
                                                                 ▼
                                                     [suggestions JSON]
                                                                 │
                                                                 ▼
                                                        [React UI renders]
```

The prompt built by the server includes:
- Free-form user description of what they want to cook
- Optional dietary preferences (vegetarian, vegan, keto, …)
- Optional cuisine style (Italian, Mexican, Indian, …)
- Optional meal type (breakfast, lunch, dinner, snack)
- Optional available ingredients

The response is parsed as JSON on the server and returned to the client.

## Env vars

| Variable            | Where it lives | Purpose                                  |
|---------------------|----------------|------------------------------------------|
| `EMERGENT_LLM_KEY`  | Server only ⚠️| Auth for the Emergent LLM API            |

## 🧭 Common tasks

- **Get / rotate a key**: In the Emergent dashboard → **Profile → Universal Key**. Copy the value into `EMERGENT_LLM_KEY` and redeploy.
- **Check remaining budget**: Same page in the Emergent dashboard — shows current balance and usage.
- **Top up**: **Profile → Universal Key → Add Balance**, or enable auto top-up.
- **Change the model**: The server code selects a specific model when building the request. Update that model name in `app/api/[[...path]]/route.js` and redeploy.

## Debugging AI suggestions

Symptoms and where to look:

| Symptom                                        | Likely cause                                 | Fix                                                            |
|------------------------------------------------|----------------------------------------------|----------------------------------------------------------------|
| 500 from `/api/meal-suggestions`               | `EMERGENT_LLM_KEY` missing/wrong             | Confirm env var is set for the deployment; check logs.         |
| 402 / "insufficient balance"                   | Budget exhausted                             | Top up in the Emergent dashboard.                              |
| Returns text but the UI shows nothing          | JSON parse failure on the server             | Log the raw model output; adjust the prompt to enforce JSON.   |
| Slow (>15s) responses                          | Cold start or provider latency               | Retry; consider a smaller/faster model in the request.         |
| Same suggestion regardless of prompt           | Prompt is being ignored / cached             | Check that the server actually forwards the user prompt.       |

Server-side logs (see [operations/debugging.md](../operations/debugging.md#-where-logs-actually-live)) will contain the API's error body — that's usually enough to diagnose in one look.

## Limits & caveats

- **Not free**: every request costs budget. Don't call the endpoint on every keystroke; only on explicit submit.
- **Not deterministic**: two identical prompts can return different suggestions. Don't rely on exact string matching in tests.
- **Response shape**: we ask the model for JSON, but LLMs occasionally return prose. The server should defensively parse and fall back gracefully — if you touch the prompt, keep this behaviour intact.
