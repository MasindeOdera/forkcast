import fs from 'node:fs/promises';
import path from 'node:path';

// ─── Metadata ────────────────────────────────────────────────────────
// Google Play requires a publicly-accessible privacy-policy URL. This
// route serves store/PRIVACY_POLICY.md so it deploys wherever Forkcast
// is hosted — e.g. https://forkcast-six.vercel.app/privacy.
export const metadata = {
  title: 'Privacy Policy — Forkcast',
  description:
    'How Forkcast collects, uses, and protects your data. Required by the Google Play Store submission.',
};

// Static generation is fine — the policy only changes when the .md file
// changes, at which point Vercel/Next will rebuild the page.
export const dynamic = 'force-static';

async function loadPolicy() {
  const file = path.join(process.cwd(), 'store', 'PRIVACY_POLICY.md');
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return '# Privacy Policy\n\n_Coming soon._';
  }
}

// Minimal, dependency-free markdown-to-JSX renderer. We deliberately
// avoid pulling in `react-markdown` + `remark-gfm` just for one static
// page — the source markdown uses only the subset supported below.
function renderMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listItems = [];
  let paraBuf = [];
  let quoteBuf = [];

  const flushList = () => {
    if (!inList) return;
    out.push(
      <ul key={`ul-${out.length}`} className="list-disc pl-6 my-3 space-y-1">
        {listItems.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </ul>
    );
    inList = false;
    listItems = [];
  };

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    const text = paraBuf.join(' ');
    out.push(
      <p key={`p-${out.length}`} className="leading-relaxed my-3">
        {inline(text)}
      </p>
    );
    paraBuf = [];
  };

  const flushQuote = () => {
    if (quoteBuf.length === 0) return;
    const text = quoteBuf.join(' ');
    out.push(
      <blockquote
        key={`q-${out.length}`}
        className="border-l-4 border-primary/50 bg-muted/40 pl-4 py-2 my-3 text-sm"
      >
        {inline(text)}
      </blockquote>
    );
    quoteBuf = [];
  };

  const flushTable = () => {
    if (!inTable) return;
    const [head, , ...body] = tableRows;
    const headCells = head.split('|').slice(1, -1).map((s) => s.trim());
    const rows = body.map((r) => r.split('|').slice(1, -1).map((s) => s.trim()));
    out.push(
      <div key={`tbl-${out.length}`} className="my-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {headCells.map((c, i) => (
                <th key={i} className="border-b p-2 text-left font-semibold">
                  {inline(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="border-b p-2 align-top">
                    {inline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    inTable = false;
    tableRows = [];
  };

  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
    flushTable();
  };

  const inline = (s) => {
    // Bold **x** and italics _x_ and inline `code`.
    const parts = [];
    let rest = s;
    let key = 0;
    while (rest.length) {
      const bold = rest.match(/^\*\*(.+?)\*\*/);
      const em = rest.match(/^_(.+?)_/);
      const code = rest.match(/^`(.+?)`/);
      if (bold) {
        parts.push(<strong key={key++}>{bold[1]}</strong>);
        rest = rest.slice(bold[0].length);
      } else if (em) {
        parts.push(<em key={key++}>{em[1]}</em>);
        rest = rest.slice(em[0].length);
      } else if (code) {
        parts.push(
          <code key={key++} className="px-1 py-0.5 rounded bg-muted text-xs">
            {code[1]}
          </code>
        );
        rest = rest.slice(code[0].length);
      } else {
        // Take chars up to the next marker.
        const next = rest.search(/(\*\*|_|`)/);
        if (next === -1) {
          parts.push(rest);
          rest = '';
        } else if (next === 0) {
          // The marker at position 0 didn't form a valid pair above —
          // consume it as literal text so we always make forward progress
          // (otherwise this loop would spin forever on unmatched `_` etc.).
          parts.push(rest[0]);
          rest = rest.slice(1);
        } else {
          parts.push(rest.slice(0, next));
          rest = rest.slice(next);
        }
      }
    }
    return parts;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Table (|...|) — flush other blocks first.
    if (line.startsWith('|') && line.endsWith('|')) {
      flushPara(); flushQuote(); flushList();
      inTable = true;
      tableRows.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // List item.
    if (line.startsWith('- ')) {
      flushPara(); flushQuote();
      inList = true;
      listItems.push(line.slice(2));
      continue;
    } else if (inList && line !== '') {
      flushList();
    } else if (inList && line === '') {
      flushList();
      continue;
    }

    // Blockquote — buffer consecutive `> ` lines into one <blockquote>.
    if (line.startsWith('> ')) {
      flushPara();
      quoteBuf.push(line.slice(2));
      continue;
    } else if (quoteBuf.length > 0) {
      flushQuote();
    }

    // Headings — always break paragraphs first.
    if (line.startsWith('### ')) {
      flushPara();
      out.push(
        <h3 key={out.length} className="text-lg font-semibold mt-6 mb-2">
          {inline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      flushPara();
      out.push(
        <h2 key={out.length} className="text-xl font-bold mt-8 mb-3">
          {inline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      flushPara();
      out.push(
        <h1 key={out.length} className="text-3xl font-bold mt-4 mb-4">
          {inline(line.slice(2))}
        </h1>
      );
    } else if (line === '---') {
      flushPara();
      out.push(<hr key={out.length} className="my-6 border-muted" />);
    } else if (line === '') {
      // Blank line ends the current paragraph.
      flushPara();
    } else {
      // Accumulate into the current paragraph buffer so bold/italic
      // markers that span soft line breaks still resolve correctly.
      paraBuf.push(line);
    }
  }
  flushAll();
  return out;
}

export default async function PrivacyPage() {
  const md = await loadPolicy();
  return (
    <main className="container max-w-3xl py-10 px-4">
      <a
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Forkcast
      </a>
      <article className="prose prose-neutral max-w-none mt-6">
        {renderMarkdown(md)}
      </article>
    </main>
  );
}
