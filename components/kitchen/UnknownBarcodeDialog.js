'use client';

/**
 * components/kitchen/UnknownBarcodeDialog.js
 * ------------------------------------------
 * Shown when a scanned barcode can't be resolved by any product
 * database (either it's a store-internal code, or the product just
 * isn't in Open Food Facts / UPCitemdb yet).
 *
 * We ask the user to tell us what it is — once. The result is stored
 * in IndexedDB via lib/barcode-cache.js so next time the same code is
 * scanned we skip the network entirely and just add the item.
 *
 * Props:
 *   - open           boolean
 *   - onOpenChange   (open: boolean) => void
 *   - code           string — the raw barcode (normalised)
 *   - suggestedName  optional — a hint from the caller (e.g. previous
 *                    scan attempts)
 *   - onSave         (info: {name, code}) => void|Promise — parent
 *                    persists the mapping AND performs its own
 *                    domain action (add to shopping list, add to
 *                    pantry, etc.). Dialog closes on resolve.
 *   - onSkip         () => void — user chose not to teach us; parent
 *                    decides whether to still add the raw item.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, HelpCircle } from 'lucide-react';
import { isInternalStoreCode } from '@/lib/barcode-utils';

export default function UnknownBarcodeDialog({
  open,
  onOpenChange,
  code,
  suggestedName = '',
  onSave,
  onSkip,
}) {
  const [name, setName] = useState(suggestedName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  // Reset local state whenever the dialog re-opens with a new code.
  useEffect(() => {
    if (open) {
      setName(suggestedName || '');
      setSaving(false);
      // Focus so the user can just start typing.
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, code, suggestedName]);

  const internal = isInternalStoreCode(code || '');

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSave?.({ name: trimmed, code });
      onOpenChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange?.(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            What is this?
          </DialogTitle>
          <DialogDescription>
            {internal ? (
              <>
                Barcode <span className="font-mono font-medium">{code}</span> looks like a
                store-internal code (prefix reserved for in-store use),
                so no public product database will have it. Tell us what it is
                and we&#39;ll remember it just for you.
              </>
            ) : (
              <>
                We couldn&#39;t find <span className="font-mono font-medium">{code}</span> in
                any product database. Add it once and we&#39;ll remember it
                on this device.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="unknown-barcode-name">Product name</Label>
            <Input
              ref={inputRef}
              id="unknown-barcode-name"
              placeholder="e.g. Simon Lévelt coffee, 250g"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Stored locally on this device only. Tap-scan later ={' '}
              instant add.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={handleSkip} disabled={saving}>
              Skip
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                </>
              ) : (
                'Save & add'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
