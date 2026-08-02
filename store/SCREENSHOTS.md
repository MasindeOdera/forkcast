# Screenshots — Spec & Shot List

Google Play requires **at least 2 phone screenshots**; 4–8 is the
sweet spot for conversion. Tablet screenshots are optional but boost
discoverability on 7" and 10" devices.

## Technical spec (Google's requirements)

| Form factor | Min size | Max size | Aspect ratio | File format |
|---|---|---|---|---|
| Phone | 320 px | 3840 px | Between 9:19.5 and 19.5:9 | PNG or JPEG (24-bit, no alpha) |
| 7" tablet | 320 px | 3840 px | — | PNG or JPEG |
| 10" tablet | 1080 px | 7680 px | — | PNG or JPEG |

Recommended target size for phone shots: **1080 × 1920 px, PNG**.

## Rules that trip people up

- No transparent pixels. Save as PNG-24, not PNG-32.
- No text so small it's illegible at thumbnail size.
- No device chrome / status bar mock-up that could be mistaken for
  Google's own UI (Play now flags fake system bars as "misleading").
- No promotional badges ("Editor's choice", "#1 in Food") — grounds
  for auto-rejection.

## Suggested shot list for Forkcast

Aim for a narrative: land → create → discover → plan → kitchen → AI.

| # | Screen | Caption to overlay | Notes |
|---|---|---|---|
| 1 | Discover tab, populated with 6 meals | *"Discover what people are cooking"* | Warm hero shot. Make sure a variety of cuisines are visible. |
| 2 | Meal detail with a photo, ingredients, instructions | *"Every recipe, one tap away"* | Show the ingredient list clearly. |
| 3 | Add Meal form with a photo already picked | *"Add your own in seconds"* | Draws the eye to the photo picker. |
| 4 | Weekly Planner with meals slotted across the days | *"Plan the whole week"* | The drag-and-drop is Forkcast's flagship. |
| 5 | Kitchen → Pantry with a barcode scanner overlay | *"Scan pantry items with your camera"* | Show the viewfinder, but hide any real barcode number. |
| 6 | Shopping List generated from planner | *"Auto-generated shopping list"* | Show quantities. |
| 7 | AI Suggestions panel with 3 idea cards | *"AI ideas from your pantry"* | Under the *Plan* tab. |
| 8 | Share Plan modal showing QR code + Bluetooth option | *"Share plans instantly"* | Optional but a nice closer. |

## How to actually capture them

Easiest (matches Play's rendering perfectly):

```bash
adb shell screencap -p /sdcard/forkcast-01.png
adb pull /sdcard/forkcast-01.png
```

Or, on a device connected via `adb`:

```bash
adb exec-out screencap -p > forkcast-01.png
```

Alternative: use Chrome DevTools' device toolbar at **Pixel 7 (1080x2400)**
for the deployed PWA — close enough to a screenshot for store use, and
you can control every pixel.

## Adding captions cleanly

Do NOT hand-draw text on top of the screenshot. Instead:

1. Take the raw screenshot (no annotations).
2. In Figma / any design tool, place the shot on a **1080×1920** canvas
   with 80 px top padding for a caption strip. Emerald background.
3. White SF Pro / Inter Bold caption, 64 px.
4. Export at 100% PNG-24.

A Figma template is left as an exercise — the visual style should match
the existing Forkcast palette: `#10B981` primary, `#F59E0B` accent,
`#0f172a` text.

## Naming convention

Upload with descriptive filenames so future-you can find them:

```
forkcast-phone-01-discover.png
forkcast-phone-02-meal-detail.png
forkcast-phone-03-add-meal.png
forkcast-phone-04-planner.png
forkcast-phone-05-pantry-scan.png
forkcast-phone-06-shopping-list.png
forkcast-phone-07-ai-ideas.png
forkcast-phone-08-share-plan.png
```
