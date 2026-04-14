'use client';

import { formatShortcut } from '@/hooks/useKeyboardShortcut';

interface ShortcutBadgeProps {
  shortcut: string | string[];
  className?: string;
  variant?: 'default' | 'compact' | 'inline';
}

/**
 * ShortcutBadge Component
 * 
 * Displays keyboard shortcut badges next to buttons/actions
 * 
 * @example
 * <button>
 *   Process Payment
 *   <ShortcutBadge shortcut="ctrl+p" />
 * </button>
 * 
 * @example
 * <ShortcutBadge shortcut={['f2', '/']} variant="compact" />
 */
export function ShortcutBadge({ shortcut, className = '', variant = 'default' }: ShortcutBadgeProps) {
  const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];
  
  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        {shortcuts.map((key, idx) => (
          <span key={idx} className="inline-flex items-center gap-0.5">
            {idx > 0 && <span className="text-[9px] text-stone-400 mx-0.5">or</span>}
            <kbd className="px-1 py-0.5 text-[9px] font-mono font-semibold text-stone-600 bg-stone-100 border border-stone-300 rounded shadow-sm">
              {formatShortcut(key)}
            </kbd>
          </span>
        ))}
      </span>
    );
  }
  
  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 ml-2 ${className}`}>
        {shortcuts.map((key, idx) => (
          <span key={idx} className="inline-flex items-center gap-0.5">
            {idx > 0 && <span className="text-[10px] text-white/50 mx-0.5">or</span>}
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white/20 border border-white/30 rounded">
              {formatShortcut(key)}
            </kbd>
          </span>
        ))}
      </span>
    );
  }
  
  // Default variant
  return (
    <span className={`inline-flex items-center gap-1 ml-2 ${className}`}>
      {shortcuts.map((key, idx) => (
        <span key={idx} className="inline-flex items-center gap-0.5">
          {idx > 0 && <span className="text-[10px] text-stone-400 mx-0.5">or</span>}
          <kbd className="px-2 py-1 text-[10px] font-mono font-semibold text-stone-700 bg-stone-100 border border-stone-300 rounded shadow-sm">
            {formatShortcut(key)}
          </kbd>
        </span>
      ))}
    </span>
  );
}

/**
 * ShortcutHint Component
 * 
 * Displays a subtle hint about keyboard shortcuts
 * Useful for tooltips or help text
 */
export function ShortcutHint({ shortcut, description, className = '' }: {
  shortcut: string | string[];
  description: string;
  className?: string;
}) {
  const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];
  
  return (
    <div className={`flex items-center gap-2 text-xs text-stone-500 ${className}`}>
      <span>{description}</span>
      <span className="inline-flex items-center gap-1">
        {shortcuts.map((key, idx) => (
          <span key={idx} className="inline-flex items-center gap-0.5">
            {idx > 0 && <span className="text-[9px] mx-0.5">or</span>}
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-semibold text-stone-600 bg-stone-50 border border-stone-200 rounded">
              {formatShortcut(key)}
            </kbd>
          </span>
        ))}
      </span>
    </div>
  );
}
