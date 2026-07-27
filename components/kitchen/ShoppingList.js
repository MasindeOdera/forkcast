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
 *     name against uncchecked list items and tick the closest one.
 *   - "Clear checked" removes finished items in one tap.
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

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

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
   * Handle a barcode scan while shopping. We resolve the barcode to a
   * product name (Open Food Facts via /api/barcode-lookup) and then
   * try to tick off the closest matching item in the list. Fuzzy match
   * is a simple case-insensitive substring — good enough given users
   * scan groceries they already added by name.
   */
  const handleBarcode = async ({ code }) => {
    const lookup = await apiGet(`/api/barcode-lookup?code=${encodeURIComponent(code)}`);
    const productName = lookup.ok && lookup.data?.found ? lookup.data.name : null;
    if (!productName) {
      toast.warning("Couldn't identify the product. Scan again or tap it manually.");
      return;
    }
    const target = items.find(
      (i) => !i.checked && (
        i.name.toLowerCase().includes(productName.toLowerCase()) ||
        productName.toLowerCase().includes(i.name.toLowerCase())
      )
    );
    if (!target) {
      toast(`Scanned ${productName} — not on your list. Tap +Add if you want it.`);
      return;
    }
    await toggle(target);
    toast.success(`Ticked off ${target.name}`);
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
    </div>
  );
}

function ShoppingRow({ item, onToggle, onRemove }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
        <Checkbox checked={item.checked} onCheckedChange={() => onToggle(item)} />
        <span className={`truncate ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
          {item.name}
        </span>
      </label>
      <Button size="sm" variant="ghost" onClick={() => onRemove(item)} aria-label={`Remove ${item.name}`}>
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </li>
  );
}
