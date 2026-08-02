# Feature Graphic — 1024×500

The feature graphic is the wide banner that shows above your app in
search results and on your Play Store listing page. It's required.

## Spec

- **Size:** 1024 × 500 px, exactly.
- **Format:** PNG or JPEG (24-bit, no alpha).
- **File size:** ≤ 1 MB.
- **Text:** Keep any text large — Play crops the graphic on some
  surfaces (e.g. it shows just the top 500×500 on square placements).
- **Do NOT** include:
  - The app name in an ambiguous position (Play already shows your
    name below the graphic).
  - Google logos / branding.
  - Fake system UI (status bars, keyboards) that could look like
    real Android.

## Ready-to-render SVG template

Save the file below to `store/feature-graphic.svg`, then export at
1024×500 with any tool (Figma, Inkscape, or
`cairosvg store/feature-graphic.svg -o feature-graphic.png -W 1024 -H 500`).

```svg
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" width="1024" height="500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="500" fill="url(#bg)"/>

  <!-- decorative dots (steam) -->
  <g fill="white" opacity="0.15">
    <circle cx="80"  cy="70"  r="6"/>
    <circle cx="140" cy="110" r="4"/>
    <circle cx="200" cy="60"  r="5"/>
    <circle cx="920" cy="420" r="6"/>
    <circle cx="860" cy="460" r="4"/>
  </g>

  <!-- Left side: brand -->
  <g transform="translate(80 140)">
    <!-- app icon -->
    <rect x="0" y="0" width="140" height="140" rx="28" fill="white"/>
    <g stroke="#059669" stroke-linecap="round" fill="#059669">
      <rect x="38" y="20" width="6" height="32" rx="3"/>
      <rect x="52" y="20" width="6" height="32" rx="3"/>
      <rect x="66" y="20" width="6" height="32" rx="3"/>
      <rect x="38" y="48" width="34" height="7" rx="3.5"/>
      <rect x="52" y="52" width="6" height="70" rx="3"/>
    </g>
    <ellipse cx="104" cy="98" rx="32" ry="12" fill="#F59E0B"/>
    <ellipse cx="104" cy="95" rx="26" ry="8"  fill="#FBBF24"/>

    <text x="170" y="70" fill="white" font-family="Inter, Helvetica, Arial, sans-serif"
          font-weight="800" font-size="72">Forkcast</text>
    <text x="172" y="115" fill="#ecfdf5" font-family="Inter, Helvetica, Arial, sans-serif"
          font-weight="500" font-size="28">Meal planning made easy</text>
  </g>

  <!-- Right side: mock phone -->
  <g transform="translate(700 55)">
    <rect x="0" y="0" width="240" height="400" rx="32" fill="#0f172a"/>
    <rect x="10" y="10" width="220" height="380" rx="24" fill="url(#card)"/>
    <!-- fake tab bar -->
    <rect x="20" y="22" width="200" height="16" rx="8" fill="#e2e8f0"/>
    <!-- fake meal card 1 -->
    <rect x="20"  y="52"  width="200" height="90" rx="12" fill="#ecfdf5"/>
    <rect x="30"  y="62"  width="70"  height="70" rx="8"  fill="#F59E0B"/>
    <rect x="110" y="66"  width="100" height="12" rx="6"  fill="#0f172a"/>
    <rect x="110" y="84"  width="80"  height="8"  rx="4"  fill="#94a3b8"/>
    <rect x="110" y="98"  width="70"  height="8"  rx="4"  fill="#94a3b8"/>
    <rect x="110" y="112" width="90"  height="8"  rx="4"  fill="#94a3b8"/>
    <!-- fake meal card 2 -->
    <rect x="20"  y="152" width="200" height="90" rx="12" fill="#fef3c7"/>
    <rect x="30"  y="162" width="70"  height="70" rx="8"  fill="#DC2626"/>
    <rect x="110" y="166" width="100" height="12" rx="6"  fill="#0f172a"/>
    <rect x="110" y="184" width="80"  height="8"  rx="4"  fill="#94a3b8"/>
    <rect x="110" y="198" width="70"  height="8"  rx="4"  fill="#94a3b8"/>
    <rect x="110" y="212" width="90"  height="8"  rx="4"  fill="#94a3b8"/>
    <!-- fake meal card 3 -->
    <rect x="20"  y="252" width="200" height="90" rx="12" fill="#fce7f3"/>
    <rect x="30"  y="262" width="70"  height="70" rx="8"  fill="#065F46"/>
    <rect x="110" y="266" width="100" height="12" rx="6"  fill="#0f172a"/>
    <rect x="110" y="284" width="80"  height="8"  rx="4"  fill="#94a3b8"/>
    <rect x="110" y="298" width="70"  height="8"  rx="4"  fill="#94a3b8"/>
    <rect x="110" y="312" width="90"  height="8"  rx="4"  fill="#94a3b8"/>
    <!-- FAB -->
    <circle cx="195" cy="370" r="20" fill="#10B981"/>
    <rect x="192" y="360" width="6" height="20" rx="3" fill="white"/>
    <rect x="185" y="367" width="20" height="6" rx="3" fill="white"/>
  </g>
</svg>
```

## Render command

From the repo root, with cairosvg installed:

```bash
pip install cairosvg
python3 -c "import cairosvg; cairosvg.svg2png(url='store/feature-graphic.svg', output_width=1024, output_height=500, write_to='store/feature-graphic.png')"
```

Or in Figma/Illustrator: paste the SVG, export as PNG at 1024×500.

Then upload `store/feature-graphic.png` to Play Console → Store
listing → Graphics → Feature graphic.
