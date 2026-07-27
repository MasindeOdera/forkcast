'use client';

/**
 * components/BarcodeScanner.js
 * ----------------------------
 * A single, self-contained barcode-scanning dialog.
 *
 * How it picks a strategy (see lib/native/scanner.js for the full
 * fallback chain):
 *   - Capacitor native   → handled by the plugin, no in-page UI
 *   - Camera-based (BarcodeDetector / ZXing) → shows a <video> preview
 *   - Manual entry only  → shows a numeric input; also captures the
 *     invisible "HID keyboard" input a Bluetooth handheld scanner emits
 *
 * Public props:
 *   - open           boolean
 *   - onOpenChange   (open: boolean) => void
 *   - onDetected     ({ code: string, format: string }) => void
 *   - title          e.g. "Scan into pantry", "Scan off shopping list"
 *   - allowManual    default true — show the "Type code instead" tab
 */

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Camera, Keyboard, Loader2, AlertTriangle } from 'lucide-react';
import { scanOnce, detectStrategy } from '@/lib/native/scanner';

export default function BarcodeScanner({
  open,
  onOpenChange,
  onDetected,
  title = 'Scan a barcode',
  allowManual = true,
}) {
  const videoRef = useRef(null);
  const abortRef = useRef(null);
  const [strategy, setStrategy] = useState('manual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [tab, setTab] = useState('camera');

  // ---- Strategy detection (client-only) ----------------------------
  useEffect(() => {
    const s = detectStrategy();
    setStrategy(s);
    // If the device has no camera at all, jump straight to manual.
    if (s === 'manual') setTab('manual');
  }, []);

  // ---- Camera scanning lifecycle -----------------------------------
  useEffect(() => {
    if (!open || tab !== 'camera') return undefined;
    // Capacitor path is one-shot — it opens a native scanner UI and
    // returns. Don't attach the <video> in that case.
    if (strategy === 'capacitor') {
      runCapacitorScan();
      return () => {};
    }
    if (strategy === 'manual') return undefined;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);

    // IMPORTANT: Defer the actual scan until after the next paint so
    // that videoRef.current is guaranteed to be attached. Without this,
    // Radix Tabs can mount <TabsContent value="camera"> *after* the
    // effect fires when the dialog opens from a state where the
    // scanner wasn't previously visible — in which case videoRef.current
    // is still null and scanOnce() throws "videoEl is required for
    // web-based scanning". requestAnimationFrame is the smallest,
    // reliable "wait for the next commit" primitive we have.
    let rafId = 0;
    const cancelled = () => controller.signal.aborted;

    const start = async () => {
      if (!videoRef.current) {
        await new Promise((resolve) => {
          rafId = requestAnimationFrame(resolve);
        });
      }
      if (cancelled()) return;
      if (!videoRef.current) {
        setBusy(false);
        setError('Camera preview did not mount. Try closing and reopening the scanner, or use the Type tab.');
        return;
      }
      try {
        const result = await scanOnce({
          videoEl: videoRef.current,
          signal: controller.signal,
        });
        setBusy(false);
        if (result && !cancelled()) {
          onDetected?.(result);
          onOpenChange?.(false);
        }
      } catch (err) {
        if (cancelled()) return;
        setBusy(false);
        const msg = String(err?.message || '');
        if (/permission|denied|notallowed/i.test(msg)) {
          setError('Camera permission was blocked. Enable it in your browser settings, or use the Type tab.');
        } else {
          setError(msg || 'Camera unavailable');
        }
      }
    };

    start();

    return () => {
      controller.abort();
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, strategy]);

  const runCapacitorScan = async () => {
    setBusy(true);
    try {
      const result = await scanOnce();
      if (result) {
        onDetected?.(result);
        onOpenChange?.(false);
      } else {
        onOpenChange?.(false);
      }
    } catch (err) {
      setError(err?.message || 'Scanner unavailable');
    } finally {
      setBusy(false);
    }
  };

  // ---- HID scanner support (BLE keyboard-emulation) ----------------
  // A Bluetooth HID barcode scanner acts as a keyboard — when the user
  // scans, characters are "typed" fast and finish with Enter. We focus
  // the manual input whenever the dialog is open so those keystrokes
  // land there without the user tapping anything.
  const manualInputRef = useRef(null);
  useEffect(() => {
    if (open && manualInputRef.current) {
      const t = setTimeout(() => manualInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, tab]);

  const submitManual = (e) => {
    e?.preventDefault?.();
    const code = manualCode.trim();
    if (!code) return;
    onDetected?.({ code, format: 'manual' });
    setManualCode('');
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Point the camera at a barcode, or enter the code manually. A
            Bluetooth barcode reader will also just work.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="camera" disabled={strategy === 'manual'}>
              <Camera className="h-4 w-4 mr-2" /> Camera
            </TabsTrigger>
            {allowManual && (
              <TabsTrigger value="manual">
                <Keyboard className="h-4 w-4 mr-2" /> Type
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="camera" className="space-y-3">
            {strategy === 'capacitor' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Launching native scanner…
              </div>
            ) : (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Aiming reticle for UX — shows the user where to aim. */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-4/5 h-1/3 border-2 border-white/70 rounded-md shadow-lg" />
                </div>
                {busy && (
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                    Scanning…
                  </div>
                )}
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </TabsContent>

          {allowManual && (
            <TabsContent value="manual" className="space-y-3">
              <form onSubmit={submitManual} className="space-y-3">
                <Input
                  ref={manualInputRef}
                  inputMode="numeric"
                  placeholder="e.g. 3017624010701"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/[^\dA-Za-z]/g, ''))}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Bluetooth HID barcode scanners will type into this box
                  automatically — no configuration needed.
                </p>
                <Button type="submit" className="w-full" disabled={!manualCode.trim()}>
                  Use this code
                </Button>
              </form>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
