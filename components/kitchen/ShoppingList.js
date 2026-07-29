'use client';

/**
 * components/kitchen/ShoppingList.js
 * ----------------------------------
 * Shopping list sub-tab.
 *
 * Behaviours:
 *   - "Generate from planned meals" — hits /api/shopping-list/generate
 *     which walks the week's meal_plans and aggregates ingredients.
 *   - Tick items manually or by scanning a barcode. A scanned code is
 *     resolved via /api/barcode-lookup; we then fuzzy-match the product
 *     name against unchecked list items and tick the closest one. If
 *     nothing matches, we add the product to the list so no scan is
 *     ever silently discarded.
 *   - "Clear checked" removes finished items in one tap.
 *
 * Barcode failure modes (see handleBarcode for details):
 *   - transient lookup error → toast, list unchanged
 *   - genuine miss           → open UnknownBarcodeDialog for one-time
 *                              teach-then-remember
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScanLine, Plus, RefreshCw, ShoppingCart, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { EmptyState } from '@/components/ui/empty-state';
import BarcodeScanner from '@/components/BarcodeScanner';
import UnknownBarcodeDialog from '@/components/kitchen/UnknownBarcodeDialog';
import { getCached, setCached } from '@/lib/barcode-cache';

// Dev flag — flip to `true` (or set NEXT_PUBLIC_DEBUG_BARCODE=1) to
// mirror every scan resolution to the browser console. Handy for
// diagnosing "the scanner said it didn't recognize this item" reports
// where the user swears the barcode is a known product.
const DEBUG_BARCODE = typeof process !== 'undefined'
  && process.env?.NEXT_PUBLIC_DEBUG_BARCODE === '1';

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  // When an unknown barcode is scanned we stash it here and let the
  // UnknownBarcodeDialog collect the user's chosen name.
  const [unknownBarcode, setUnknownBarcode] = useState(null);

  const load = async () => {
    setLoading(true);
    const res = await apiGet('/api/shopping-list');
    if (res.ok) setItems(res.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addManual = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await apiPost('/api/shopping-list', { name: trimmed });
    if (res.ok) {
      setItems((cur) => [...cur, res.data]);
      setName('');
    } else toast.error(res.error?.message || 'Could not add item');
  };

  const toggle = async (item) => {
    // Optimistic — UX must feel instant when ticking off in a shop.
    const next = !item.checked;
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, checked: next } : i)));
    const res = await apiPut(`/api/shopping-list/${item.id}`, { checked: next });
    if (!res.ok) {
      setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, checked: !next } : i)));
      toast.error('Could not update item');
    }
  };

  const remove = async (item) => {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    const res = await apiDelete(`/api/shopping-list/${item.id}`);
    if (!res.ok) { setItems(prev); toast.error('Could not remove item'); }
  };

  const clearChecked = async () => {
    const prev = items;
    setItems((cur) => cur.filter((i) => !i.checked));
    const res = await apiDelete('/api/shopping-list?checked=true');
    if (!res.ok) { setItems(prev); toast.error('Could not clear checked items'); }
    else toast.success('Cleared checked items');
  };

  const generateFromWeek = async () => {
    setGenerating(true);
    // Range = the current calendar week (Mon–Sun). Kept inline to
    // avoid pulling date-fns for one call — keeps the bundle lean.
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7)); monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const iso = (d) => d.toISOString().slice(0, 10);
    const res = await apiPost('/api/shopping-list/generate', {
      startDate: iso(monday),
      endDate: iso(sunday),
    });
    setGenerating(false);
    if (res.ok) {
      setItems(res.data?.items || []);
      toast.success(
        res.data?.inserted > 0
          ? `Added ${res.data.inserted} items from this week's plan`
          : 'Nothing new to add — you\u2019re all set!'
      );
    } else {
      toast.error(res.error?.message || 'Could not generate shopping list');
    }
  };

  /**
   * Given a resolved product name (and optionally the barcode that
   * resolved it), do the right thing on the shopping list:
   *
   *   1. If we ALREADY have that same barcode on the list, we're
   *      re-scanning what the user just added — treat it as "I bought
   *      this" and tick it off. Deterministic; unaffected by whether
   *      OFF returns a slightly different `product_name` the second
   *      time round.
   *   2. Else if a fuzzy name match on an unchecked item wins, tick
   *      that one off. This is the pre-scanner path used for
   *      manually-typed items ("sugar" ticked off by scanning any
   *      sugar product).
   *   3. Otherwise, ADD the item to the list — so a scanned product is
   *      never silently dropped.
   *
   * Root cause of the "8710437003216 doesn't display" report (Jul 2026):
   * we used to jump straight to step 2 (fuzzy name), which meant the
   * SECOND scan of a code (whose product name matched the row added by
   * the FIRST scan) would tick it off and move it into "Already in the
   * cart" — the user then thought the scan hadn't worked. Matching on
   * barcode first makes the tick-off intentional AND enables the row
   * to appear in the visible "To buy" list after the first scan.
   */
  const tickOffByProductName = async (productName, { code = null } = {}) => {
    // Step 1 — deterministic barcode match. Only unchecked rows: a
    // ticked-off row shouldn't magically un-tick when re-scanned.
    const byBarcode = code
      ? items.find((i) => !i.checked && i.barcode && i.barcode === code)
      : null;
    if (byBarcode) {
      await toggle(byBarcode);
      toast.success(`Ticked off ${byBarcode.name}`);
      return;
    }

    // Step 2 — fuzzy name match for manually-typed items.
    const byName = items.find(
      (i) => !i.checked && (
        i.name.toLowerCase().includes(productName.toLowerCase()) ||
        productName.toLowerCase().includes(i.name.toLowerCase())
      )
    );
    if (byName) {
      await toggle(byName);
      toast.success(`Ticked off ${byName.name}`);
      return;
    }

    // Step 3 — new item. Persist name AND barcode so subsequent scans
    // in step 1 can find it deterministically.
    const res = await apiPost('/api/shopping-list', {
      name: productName,
      ...(code ? { barcode: code } : {}),
    });
    if (res.ok) {
      setItems((cur) => [...cur, res.data]);
      toast.success(`Added ${productName} to your list`);
    } else {
      toast.error(res.error?.message || `Recognised ${productName}, but could not add it to your list.`);
    }
  };

  /**
   * Handle a barcode scan while shopping. Resolution order:
   *   1. Local IndexedDB cache (either a previous OFF/UPCitemdb hit
   *      OR a user-taught mapping). Instant, offline-friendly.
   *   2. /api/barcode-lookup (Open Food Facts family + UPCitemdb chain
   *      — see lib/barcode-lookup.js).
   *   3. If both miss, pop UnknownBarcodeDialog so the user can teach
   *      us the product name once, and remember it forever.
   *
   * Error-handling contract (added Jul 2026):
   *   - lookup HTTP failure  → toast.error, do NOT open the "What is
   *     this?" dialog (that dialog is for genuine misses, not for
   *     transient network / rate-limit issues).
   *   - lookup returns found:true with brand-only (name === null) →
   *     use brand as productName. Previously we treated this as
   *     unknown, which was the bug behind "the scanner doesn't
   *     recognize this well-known product" reports.
   */
  const handleBarcode = async ({ code }) => {
    if (DEBUG_BARCODE) console.log('[barcode] scan received:', code);

    // 1) Try local cache first — this is what makes repeat scans
    //    instant and lets user-taught mappings work offline.
    const cached = await getCached(code);
    if (cached?.name) {
      if (DEBUG_BARCODE) console.log('[barcode] cache hit:', cached);
      await tickOffByProductName(cached.name, { code });
      return;
    }

    // 2) Network lookup via the multi-source proxy.
    const lookup = await apiGet(`/api/barcode-lookup?code=${encodeURIComponent(code)}`);
    if (DEBUG_BARCODE) console.log('[barcode] lookup response:', lookup);

    // 2a) Distinguish an HTTP failure from a genuine miss. A 5xx or
    //     network error is NOT the user's fault and should not push
    //     them into the "teach me" dialog. We branch on the canonical
    //     `error.code` from api-client so each failure mode gets a
    //     specific, actionable message. SESSION_EXPIRED is handled by
    //     the global listener in app/page.js (auto-logout + toast) so
    //     we return quietly here to avoid a double-toast.
    if (!lookup.ok) {
      const code = lookup.error?.code;
      if (code === 'SESSION_EXPIRED') return;
      if (code === 'NETWORK_ERROR') {
        toast.error(lookup.error?.message || "You're offline — the barcode lookup needs a connection.");
      } else if (code === 'SERVER_ERROR') {
        toast.error('Product database is temporarily unreachable (server error). Try again in a moment.');
      } else if (lookup.status === 429) {
        toast.error('Open Food Facts rate-limited this server. Please wait a minute and try again.');
      } else {
        toast.error(
          lookup.error?.message
            || 'Product lookup service is unavailable right now. Please try again in a moment.'
        );
      }
      return;
    }

    // 2b) Genuine hit? Accept name OR brand — some Open Food Facts
    //     entries have only one populated.
    if (lookup.data?.found) {
      const productName = lookup.data.name || lookup.data.brand;
      if (productName) {
        // Save the hit to the cache so future scans skip the network.
        await setCached(code, {
          name: productName,
          brand: lookup.data.brand || null,
          image: lookup.data.image || null,
          quantity: lookup.data.quantity || null,
          source: lookup.data.source || 'off',
        });
        await tickOffByProductName(productName, { code });
        return;
      }
      // Very rare: source claimed a hit but had neither name nor brand.
      // Log for triage and fall through to the "teach me" dialog.
      console.warn('[barcode] hit had neither name nor brand:', lookup.data);
    }

    // 3) Unknown — let the user teach us. The dialog will call
    //    handleUnknownSave (below) with { name, code } once they submit.
    setUnknownBarcode(code);
  };

  /** Called from UnknownBarcodeDialog when the user names the product. */
  const handleUnknownSave = async ({ name: productName, code }) => {
    // Persist the mapping locally — highest-trust source.
    await setCached(code, { name: productName, source: 'user' });
    // Also add it to the shopping list, so the scan wasn't wasted.
    const res = await apiPost('/api/shopping-list', { name: productName, barcode: code });
    if (res.ok) {
      setItems((cur) => [...cur, res.data]);
      toast.success(`Added ${productName} to your list. Next scan is instant.`);
    } else {
      toast.error(res.error?.message || 'Saved locally but could not add to list');
    }
  };

  /** Called if the user hits Skip on the unknown-barcode dialog. */
  const handleUnknownSkip = () => {
    toast('Skipped — nothing added to the list.');
  };

  const remaining = useMemo(() => items.filter((i) => !i.checked), [items]);
  const done = useMemo(() => items.filter((i) => i.checked), [items]);

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Shopping list
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={addManual} className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Add an item manually…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={!name.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
              <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}>
                <ScanLine className="h-4 w-4 mr-1" /> Scan
              </Button>
            </div>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={generateFromWeek} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Generate from this week’s plan
            </Button>
            {done.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChecked}>
                <Trash2 className="h-4 w-4 mr-1" /> Clear {done.length} checked
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            To buy
            <Badge variant="secondary">{remaining.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Your list is empty"
              description="Add items manually, scan a barcode, or generate a list from this week's planned meals."
            />
          ) : (
            <>
              <ul className="divide-y">
                {remaining.map((item) => (
                  <ShoppingRow key={item.id} item={item} onToggle={toggle} onRemove={remove} />
                ))}
              </ul>
              {done.length > 0 && (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mt-6 mb-2">
                    Already in the cart
                  </p>
                  <ul className="divide-y opacity-60">
                    {done.map((item) => (
                      <ShoppingRow key={item.id} item={item} onToggle={toggle} onRemove={remove} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcode}
        title="Scan off your shopping list"
      />

      <UnknownBarcodeDialog
        open={!!unknownBarcode}
        onOpenChange={(next) => { if (!next) setUnknownBarcode(null); }}
        code={unknownBarcode || ''}
        onSave={handleUnknownSave}
        onSkip={handleUnknownSkip}
      />
    </div>
  );
}

function ShoppingRow({ item, onToggle, onRemove }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
        <Checkbox checked={item.checked} onCheckedChange={() => onToggle(item)} />
        <div className="min-w-0 flex-1">
          <p className={`truncate ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
            {item.name}
          </p>
          {/* Show the barcode for scan-added items so the user has a
              visible confirmation that "the scan worked" — mirrors the
              Pantry row layout ("no expiry set • 8710437003216"). */}
          {item.barcode && (
            <p className="text-xs text-muted-foreground truncate">
              {item.barcode}
            </p>
          )}
        </div>
      </label>
      <Button size="sm" variant="ghost" onClick={() => onRemove(item)} aria-label={`Remove ${item.name}`}>
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </li>
  );
}
