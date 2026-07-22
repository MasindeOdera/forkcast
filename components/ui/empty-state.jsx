'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * <EmptyState /> — the one canonical component for every "there's nothing
 * here yet", "we couldn't load this", and "still loading" screen.
 *
 * Props:
 *   variant  'empty' | 'error' | 'loading'  (default: 'empty')
 *   icon     A Lucide icon component (rendered at size h-12 w-12)
 *   title    Bold headline
 *   description  Muted supporting copy
 *   action   { label, onClick, icon?, variant? } — primary CTA
 *   secondaryAction  same shape, rendered as a ghost button next to action
 *   illustration     Optional larger illustration replaces the icon
 *   className        Tailwind extras on the outer container
 *
 * Why one component: today Discover / My Meals / suggestions / calendar all
 * roll their own empty-state layouts and copy — this consolidates them so
 * spacing, icon sizing, and CTA styles stay identical everywhere.
 */
export function EmptyState({
  variant = 'empty',
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  illustration,
  className,
}) {
  const isError = variant === 'error';
  const isLoading = variant === 'loading';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-4 rounded-lg border border-dashed bg-muted/20',
        isError && 'border-destructive/30 bg-destructive/5',
        className
      )}
    >
      {/* Illustration takes priority over icon */}
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : isLoading ? (
        <Loader2 className="h-12 w-12 text-muted-foreground animate-spin mb-4" aria-hidden="true" />
      ) : Icon ? (
        <Icon
          className={cn(
            'h-12 w-12 mb-4',
            isError ? 'text-destructive' : 'text-muted-foreground'
          )}
          aria-hidden="true"
        />
      ) : null}

      {title && (
        <h3 className={cn('text-lg font-semibold', isError && 'text-destructive')}>
          {title}
        </h3>
      )}

      {description && (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || (isError ? 'default' : 'default')}
              disabled={action.disabled}
            >
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant || 'ghost'}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.icon && <secondaryAction.icon className="mr-2 h-4 w-4" />}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
