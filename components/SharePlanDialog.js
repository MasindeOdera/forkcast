'use client';

/**
 * components/SharePlanDialog.js
 * -----------------------------
 * Modal that lets a user send a weekly plan to another device without
 * needing accounts, contacts, or an internet connection.
 *
 * Transports (see docs/features/plan-sharing.md for the full write-up):
 *
 *   Option 1 (default) — Native OS Share Sheet
 *       - navigator.share() on the web
 *       - @capacitor/share plugin when wrapped in Capacitor
 *       - Under the hood this uses AirDrop / Nearby Share, which use
 *         Bluetooth + WiFi Direct — no internet needed.
 *
 *   Option 2 (v2) — Raw BLE peer-to-peer
 *       - Shows the toggle but is disabled until the Capacitor BLE
 *         plugin ships. See lib/native/ble.js for the shape.
 *
 *   Fallback — QR code
 *       - Always available. Encodes the plan JSON as a QR the other
 *         phone scans with its camera. Guaranteed offline transfer.
 *
 * The dialog also offers a plain-text "Copy JSON" for power users, and
 * a "Receive" tab that opens the BarcodeScanner in QR mode to import a
 * plan from another device.
 */

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Share2, QrCode, Bluetooth, ClipboardCopy, ScanLine } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import BarcodeScanner from '@/components/BarcodeScanner';
import { sharePayload } from '@/lib/native/share';
import { isBlePeerAvailable, sendPlanViaBle } from '@/lib/native/ble';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open:boolean) => void} props.onOpenChange
 * @param {object} props.plan     The plan payload to share (small JSON)
 * @param {(plan:object) => void} [props.onImport]  Called with a plan when the user scans a QR
 */
export default function SharePlanDialog({ open, onOpenChange, plan, onImport }) {
  const [transport, setTransport] = useState('native'); // 'native' | 'ble' | 'qr'
  const [scannerOpen, setScannerOpen] = useState(false);
  const bleAvailable = isBlePeerAvailable();

  // Compact JSON — QR codes have limited capacity, so we keep the
  // payload lean. The receiving app decodes and merges.
  const payloadJson = useMemo(() => JSON.stringify(plan ?? {}), [plan]);

  const doNativeShare = async () => {
    const res = await sharePayload({
      title: 'Forkcast weekly plan',
      text: `${plan?.title || 'My weekly meal plan'}\n\n${payloadJson}`,
    });
    if (res.transport === 'clipboard' && res.ok) {
      toast.success('Copied to clipboard — paste it anywhere.');
    } else if (res.cancelled) {
      // silent — user chose not to share
    } else if (!res.ok) {
      toast.error('Could not open the share sheet on this device.');
    }
  };

  const doBleShare = async () => {
    try {
      await sendPlanViaBle(payloadJson);
      toast.success('Plan sent via Bluetooth');
    } catch (err) {
      toast(err?.message || 'BLE peer-to-peer is not available yet.');
    }
  };

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(payloadJson);
      toast.success('Plan JSON copied');
    } catch { toast.error('Clipboard blocked — try QR code instead.'); }
  };

  /**
   * Called by BarcodeScanner when a QR is decoded. The QR contains the
   * plan JSON; we parse it and hand off to the caller-supplied import
   * handler.
   */
  const handleImportScan = ({ code }) => {
    try {
      const parsed = JSON.parse(code);
      onImport?.(parsed);
      toast.success('Plan imported');
      onOpenChange?.(false);
    } catch {
      toast.error('Not a valid Forkcast plan QR code.');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Share your plan
            </DialogTitle>
            <DialogDescription>
              No account or internet needed on the receiving device.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="send">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="send">Send</TabsTrigger>
              <TabsTrigger value="receive">Receive</TabsTrigger>
            </TabsList>

            {/* ---------- SEND ---------- */}
            <TabsContent value="send" className="space-y-4">
              <RadioGroup value={transport} onValueChange={setTransport}>
                <TransportOption
                  value="native"
                  title="Share via device"
                  icon={Share2}
                  description="Uses AirDrop, Nearby Share, or Messages — works over Bluetooth + WiFi Direct, no internet needed."
                />
                <TransportOption
                  value="qr"
                  title="Show QR code"
                  icon={QrCode}
                  description="The other phone opens Forkcast, taps Receive, and scans this code."
                />
                <TransportOption
                  value="ble"
                  title="Raw Bluetooth (v2)"
                  icon={Bluetooth}
                  description={bleAvailable
                    ? 'Direct BLE peer-to-peer with another Forkcast device.'
                    : 'Coming when the app is wrapped in Capacitor with BLE support.'}
                  disabled={!bleAvailable}
                />
              </RadioGroup>

              <div className="pt-2">
                {transport === 'qr' ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-white p-3 rounded-lg border">
                      <QRCodeSVG value={payloadJson} size={200} includeMargin={false} />
                    </div>
                    <p className="text-xs text-muted-foreground text-center max-w-[15rem]">
                      Point the other phone’s camera at this code.
                    </p>
                  </div>
                ) : transport === 'ble' ? (
                  <Button className="w-full" onClick={doBleShare} disabled={!bleAvailable}>
                    <Bluetooth className="h-4 w-4 mr-2" /> Send via BLE
                  </Button>
                ) : (
                  <Button className="w-full" onClick={doNativeShare}>
                    <Share2 className="h-4 w-4 mr-2" /> Open share sheet
                  </Button>
                )}
              </div>

              <Button variant="ghost" size="sm" onClick={doCopy} className="w-full">
                <ClipboardCopy className="h-4 w-4 mr-2" /> Copy JSON instead
              </Button>
            </TabsContent>

            {/* ---------- RECEIVE ---------- */}
            <TabsContent value="receive" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Scan a QR code shown by another Forkcast device to import
                the plan.
              </p>
              <Button className="w-full" onClick={() => setScannerOpen(true)}>
                <ScanLine className="h-4 w-4 mr-2" /> Scan a plan QR
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleImportScan}
        title="Scan a plan QR"
        allowManual={false}
      />
    </>
  );
}

function TransportOption({ value, title, description, icon: Icon, disabled }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${disabled ? 'opacity-60' : ''}`}>
      <RadioGroupItem value={value} id={`transport-${value}`} disabled={disabled} className="mt-0.5" />
      <Label htmlFor={`transport-${value}`} className="flex-1 cursor-pointer">
        <div className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4" /> {title}
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-normal">{description}</p>
      </Label>
    </div>
  );
}
