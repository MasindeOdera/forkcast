'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * <ConfirmDialog /> — controlled shadcn AlertDialog wrapper.
 *
 * Replaces browser-native window.confirm() so destructive actions have a
 * proper focus-trapped modal, consistent styling, and a loading state
 * while the async action completes.
 *
 * Props:
 *   open           bool
 *   onOpenChange   (bool) => void
 *   title          string
 *   description    string | ReactNode
 *   confirmLabel   string, defaults to 'Confirm'
 *   cancelLabel    string, defaults to 'Cancel'
 *   destructive    bool — swaps confirm button to destructive variant
 *   loading        bool — disables buttons + shows spinner on confirm
 *   onConfirm      () => void | Promise<void>
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription asChild>
              <div>{description}</div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Prevent Radix from auto-closing while async work runs; the
              // parent controls `open` via `onOpenChange` after onConfirm.
              e.preventDefault();
              if (!loading) onConfirm?.();
            }}
            disabled={loading}
            className={cn(
              destructive &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmDialog;
