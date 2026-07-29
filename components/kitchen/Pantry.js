'use client';

/**
 * components/kitchen/Pantry.js
 * ----------------------------
 * Pantry sub-tab of the Kitchen feature. Shows the user's stocked
 * ingredients, lets them add / edit / delete items, and highlights
 * items that are expired or expiring within 3 days.
 *
 * Data flows through /api/pantry via lib/api-client so 401 responses
 * automatically trigger the auto-logout / session-expired flow already
 * wired up in app/page.js.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Trash2, ScanLine, Plus, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { EmptyState } from '@/components/ui/empty-state';
import BarcodeScanner from '@/components/BarcodeScanner';
import UnknownBarcodeDialog from '@/components/kitchen/UnknownBarcodeDialog';
import { getCached, setCached } from '@/lib/barcode-cache';

// Dev flag — flip to `true` (or set NEXT_PUBLIC_DEBUG_BARCODE=1) to
// mirror every scan resolution to the browser console. Handy for
// diagnosing "the scanner didn't recognize this item" reports.
const DEBUG_BARCODE = typeof process !== 'undefined'
  && process.env?.NEXT_PUBLIC_DEBUG_BARCODE === '1';

export default function Pantry() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState(null);

  const load = async () => {
    setLoading(true);
    const res = await apiGet('/api/pantry');
    if (res.ok) setItems(res.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addItem = async (payload) => {
    const res = await apiPost('/api/pantry', payload);
    if (!res.ok) {
      toast.error(res.error?.message || 'Could not add item');
      return;
    }
    setItems((cur) => [res.data, ...cur]);
    toast.success(`Added ${res.data.name} to your pantry`);
  };

  const removeItem = async (id) => {
    const prev = items;
    // Optimistic remove for snappy UX — rollback on error.
    setItems((cur) => cur.filter((i) => i.id !== id));
    const res = await apiDelete(`/api/pantry/${id}`);
    if (!res.ok) {
      setItems(prev);
      toast.error('Could not remove item');
    }
  };

  const handleManualAdd = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addItem({
      name: trimmed,
      expiresAt: expiresAt || null,
    });
    setName('');
    setExpiresAt('');
  };

  // Handler for the barcode scanner — resolution order matches
  // ShoppingList: cache → /api/barcode-lookup → UnknownBarcodeDialog.
  //
  // Error-handling contract (added Jul 2026):
  //   - HTTP failure (5xx / network / rate-limit) → toast.error and stop.
  //     We do NOT open UnknownBarcodeDialog on a transient failure,
  //     because that trained users to teach us wrong names (fixes the
  //     "scanner didn't recognize a well-known product" class of bug).
  //   - Hit with brand-only (name === null) → treat brand as the name.
  const handleBarcode = async ({ code }) => {
    if (DEBUG_BARCODE) console.log('[barcode] scan received:', code);

    // 1) Local cache (previous hits + user-taught mappings).
    const cached = await getCached(code);
    if (cached?.name) {
      if (DEBUG_BARCODE) console.log('[barcode] cache hit:', cached);
      addItem({ name: cached.name, barcode: code });
      return;
    }
    // 2) Multi-source network lookup.
    const res = await apiGet(`/api/barcode-lookup?code=${encodeURIComponent(code)}`);
    if (DEBUG_BARCODE) console.log('[barcode] lookup response:', res);

    // 2a) Distinguish an HTTP failure from a genuine miss — the "teach
    //     me" dialog is only for actual misses, not transient outages.
    //     Branch on the canonical `error.code` from api-client so each
    //     failure mode gets a specific, actionable message.
    if (!res.ok) {
      const code = res.error?.code;
      if (code === 'SESSION_EXPIRED') {
        toast.error('Your session has expired. Please log out and log in again to scan.');
      } else if (code === 'NETWORK_ERROR') {
        toast.error(res.error?.message || "You're offline — the barcode lookup needs a connection.");
      } else if (code === 'SERVER_ERROR') {
        toast.error('Product database is temporarily unreachable (server error). Try again in a moment.');
      } else if (res.status === 429) {
        toast.error('Open Food Facts rate-limited this server. Please wait a minute and try again.');
      } else {
        toast.error(
          res.error?.message
            || 'Product lookup service is unavailable right now. Please try again in a moment.'
        );
      }
      return;
    }

    // 2b) Genuine hit? Accept name OR brand — some Open Food Facts
    //     entries populate only one.
    if (res.data?.found) {
      const productName = res.data.name || res.data.brand;
      if (productName) {
        await setCached(code, {
          name: productName,
          brand: res.data.brand || null,
          image: res.data.image || null,
          quantity: res.data.quantity || null,
          source: res.data.source || 'off',
        });
        addItem({ name: productName, barcode: code });
        return;
      }
      console.warn('[barcode] hit had neither name nor brand:', res.data);
    }

    // 3) Nothing found — ask the user to name it. If they Skip,
    //    we still fall back to adding "Barcode <code>" so the scan
    //    isn't lost.
    setUnknownBarcode(code);
  };

  /** Called when the user names an unknown barcode in the dialog. */
  const handleUnknownSave = async ({ name: productName, code }) => {
    await setCached(code, { name: productName, source: 'user' });
    await addItem({ name: productName, barcode: code });
  };

  /** Called if the user hits Skip on the unknown-barcode dialog. */
  const handleUnknownSkip = () => {
    // Preserve prior behaviour: still add the scan so the user can
    // rename later, but be explicit about the placeholder name.
    if (unknownBarcode) {
      addItem({ name: `Barcode ${unknownBarcode}`, barcode: unknownBarcode });
      toast('Added with barcode only — tap the item to rename.');
    }
  };

  const { fresh, expiringSoon, expired } = useMemo(() => bucketByExpiry(items), [items]);

  return (
    <div className="space-y-6">
      {/* Add controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Add to pantry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualAdd} className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label htmlFor="pantry-name" className="sr-only">Item name</Label>
              <Input
                id="pantry-name"
                placeholder="e.g. chicken, rice, tomatoes…"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="sm:w-44">
              <Label htmlFor="pantry-expiry" className="sr-only">Expires</Label>
              <Input
                id="pantry-expiry"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!name.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
              <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}>
                <ScanLine className="h-4 w-4 mr-1" /> Scan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Expired / expiring-soon call-out */}
      {(expired.length > 0 || expiringSoon.length > 0) && (
        <div className="space-y-3">
          {expired.length > 0 && (
            <ExpiryBucket
              tone="destructive"
              icon={AlertTriangle}
              title={`Expired (${expired.length})`}
              description="Toss these or mark as used to keep AI Ideas accurate."
              items={expired}
              onRemove={removeItem}
            />
          )}
          {expiringSoon.length > 0 && (
            <ExpiryBucket
              tone="warning"
              icon={AlertTriangle}
              title={`Expiring soon (${expiringSoon.length})`}
              description="Use these first — they expire within 3 days."
              items={expiringSoon}
              onRemove={removeItem}
            />
          )}
        </div>
      )}

      {/* Fresh items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">In your pantry</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : fresh.length === 0 && expired.length === 0 && expiringSoon.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Pantry is empty"
              description="Add items manually or tap Scan to add via barcode. AI Ideas will use these to suggest meals you can cook right now."
            />
          ) : (
            <ul className="divide-y">
              {fresh.map((item) => (
                <PantryRow key={item.id} item={item} onRemove={removeItem} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcode}
        title="Scan into pantry"
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

// ---------- helpers ----------------------------------------------------

function bucketByExpiry(items) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 3);

  const expired = [];
  const expiringSoon = [];
  const fresh = [];
  for (const item of items) {
    if (!item.expiresAt) { fresh.push(item); continue; }
    const exp = new Date(item.expiresAt);
    if (exp < today) expired.push(item);
    else if (exp <= soon) expiringSoon.push(item);
    else fresh.push(item);
  }
  return { fresh, expiringSoon, expired };
}

function PantryRow({ item, onRemove }) {
  return (
    <li className="flex items-center justify-between py-2 gap-3">
      <div className="min-w-0">
        <p className="font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.expiresAt ? `expires ${item.expiresAt}` : 'no expiry set'}
          {item.barcode ? ` • ${item.barcode}` : ''}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${item.name}`}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </li>
  );
}

/**
 * ExpiryBucket — a soft red / amber call-out that groups expired or
 * expiring-soon items. The tone prop maps to Tailwind border/bg
 * classes; UX goal is "clearly visible, easy to clear, not scary".
 */
function ExpiryBucket({ tone, icon: Icon, title, description, items, onRemove }) {
  const toneClasses = tone === 'destructive'
    ? 'border-destructive/40 bg-destructive/5'
    : 'border-amber-500/40 bg-amber-500/5';
  const iconClasses = tone === 'destructive' ? 'text-destructive' : 'text-amber-600';
  return (
    <Card className={`border ${toneClasses}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClasses}`} />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <Badge variant="outline" className={tone === 'destructive' ? 'border-destructive text-destructive' : 'border-amber-500 text-amber-700'}>
                  {item.expiresAt}
                </Badge>
                <span className="truncate">{item.name}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
