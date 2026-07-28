'use client';

/**
 * components/kitchen/ScanConfirmDialog.js
 * ---------------------------------------
 * Optional confirmation shown right after the camera / HID scanner
 * detects a code. Helps catch misreads before we burn a network call
 * against a wrong number.
 *
 * It is intentionally lightweight: shows the raw digits large and
 * monospaced, defaults focus to the "Looks good" button, and lets the
 * user either tweak the code inline or reject-and-rescan.
 *
 * Props:
 *   - open              boolean
 *   - onOpenChange      (open: boolean) => void
 *   - code              string — the digits captured
 *   - onConfirm         (finalCode: string) => void
 *   - onRescan          () => void — user wants to try again
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
import { CheckCircle2, RotateCcw } from 'lucide-react';

export default function ScanConfirmDialog({
  open,
  onOpenChange,
  code,
  onConfirm,
  onRescan,
}) {
  const [value, setValue] = useState(code || '');
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(code || '');
      // Focus the primary CTA so Enter = confirm.
      const t = setTimeout(() => confirmRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open, code]);

  const submit = () => {
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    onConfirm?.(trimmed);
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm scanned code</DialogTitle>
          <DialogDescription>
            Double-check the digits below before we look it up. Edit
            the box if the scanner picked up an extra character.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\dA-Za-z]/g, ''))}
          inputMode="numeric"
          className="font-mono text-lg text-center tracking-widest"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => { onOpenChange?.(false); onRescan?.(); }}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Rescan
          </Button>
          <Button ref={confirmRef} onClick={submit} disabled={!value.trim()}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Looks good
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
