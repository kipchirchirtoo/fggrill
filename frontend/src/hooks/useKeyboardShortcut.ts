import { useEffect, useRef, useCallback } from 'react';

/**
 * Keyboard Shortcut Hook
 * 
 * Registers keyboard shortcuts with context-aware behavior:
 * - Respects input fields (disabled by default)
 * - Respects modal state (disabled when modal open)
 * - Supports role-based access control
 * - Prevents default browser behavior when needed
 * 
 * @example
 * useKeyboardShortcut('ctrl+p', handlePayment, {
 *   enabled: true,
 *   disableInInputs: true,
 *   modalSafe: false,
 *   preventDefault: true
 * });
 */

export interface ShortcutOptions {
  /** Enable/disable the shortcut (useful for role-based access) */
  enabled?: boolean;
  /** Disable shortcut when focus is in input/textarea/select (default: true) */
  disableInInputs?: boolean;
  /** Disable shortcut when a modal is open (default: true) */
  modalSafe?: boolean;
  /** Prevent default browser behavior (default: true) */
  preventDefault?: boolean;
  /** Description for help overlay */
  description?: string;
}

interface KeyEvent {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

const defaultOptions: Required<Omit<ShortcutOptions, 'description'>> = {
  enabled: true,
  disableInInputs: true,
  modalSafe: true,
  preventDefault: true,
};

/**
 * Parse shortcut string into key event object
 * Supports: 'ctrl+p', 'alt+h', 'shift+enter', '/', 'f2', etc.
 */
function parseShortcut(shortcut: string): KeyEvent {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  
  return {
    key: key === 'space' ? ' ' : key,
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
  };
}

/**
 * Check if keyboard event matches shortcut definition
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyEvent): boolean {
  const eventKey = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();
  
  // Handle special keys
  const keyMatch = 
    eventKey === shortcutKey ||
    (shortcutKey === 'arrowdown' && eventKey === 'arrowdown') ||
    (shortcutKey === 'arrowup' && eventKey === 'arrowup') ||
    (shortcutKey === 'arrowleft' && eventKey === 'arrowleft') ||
    (shortcutKey === 'arrowright' && eventKey === 'arrowright') ||
    (shortcutKey === 'enter' && eventKey === 'enter') ||
    (shortcutKey === 'escape' && eventKey === 'escape') ||
    (shortcutKey === 'delete' && (eventKey === 'delete' || eventKey === 'del')) ||
    (shortcutKey === 'backspace' && eventKey === 'backspace') ||
    (shortcutKey === '+' && (eventKey === '+' || eventKey === '=')) ||
    (shortcutKey === '=' && (eventKey === '+' || eventKey === '='));
  
  return (
    keyMatch &&
    event.ctrlKey === shortcut.ctrl &&
    event.altKey === shortcut.alt &&
    event.shiftKey === shortcut.shift &&
    event.metaKey === shortcut.meta
  );
}

/**
 * Check if target element is an input field
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  
  const tagName = target.tagName.toLowerCase();
  const isContentEditable = target.isContentEditable;
  
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    isContentEditable
  );
}

/**
 * Check if a modal is currently open
 * Looks for common modal indicators in the DOM
 */
function isModalOpen(): boolean {
  // Check for common modal/dialog/overlay elements
  const modalSelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[data-modal="true"]',
    '[data-dialog="true"]',
    '.modal.show',
    '.dialog-open',
    '[data-state="open"]', // Radix UI
    '[data-headlessui-state="open"]', // Headless UI
  ];
  
  return modalSelectors.some(selector => document.querySelector(selector) !== null);
}

/**
 * Main keyboard shortcut hook
 */
export function useKeyboardShortcut(
  keys: string | string[],
  callback: (event: KeyboardEvent) => void,
  options: ShortcutOptions = {}
): void {
  const opts = { ...defaultOptions, ...options };
  const callbackRef = useRef(callback);
  const shortcutsRef = useRef<KeyEvent[]>([]);
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  // Parse shortcuts once
  useEffect(() => {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    shortcutsRef.current = keyArray.map(parseShortcut);
  }, [keys]);
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check if shortcut is enabled
    if (!opts.enabled) return;
    
    // Check if we're in an input field
    if (opts.disableInInputs && isInputElement(event.target)) return;
    
    // Check if a modal is open
    if (opts.modalSafe && isModalOpen()) return;
    
    // Check if event matches any of our shortcuts
    const matches = shortcutsRef.current.some(shortcut => matchesShortcut(event, shortcut));
    
    if (matches) {
      if (opts.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }
      callbackRef.current(event);
    }
  }, [opts.enabled, opts.disableInInputs, opts.modalSafe, opts.preventDefault]);
  
  useEffect(() => {
    if (!opts.enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, opts.enabled]);
}

/**
 * Hook for registering multiple shortcuts at once
 */
export function useKeyboardShortcuts(
  shortcuts: Array<{
    keys: string | string[];
    callback: (event: KeyboardEvent) => void;
    options?: ShortcutOptions;
  }>
): void {
  shortcuts.forEach(({ keys, callback, options }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useKeyboardShortcut(keys, callback, options);
  });
}

/**
 * Utility to format shortcut for display
 * @example formatShortcut('ctrl+p') => 'Ctrl+P'
 */
export function formatShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map(part => {
      const lower = part.toLowerCase();
      if (lower === 'ctrl' || lower === 'control') return 'Ctrl';
      if (lower === 'alt') return 'Alt';
      if (lower === 'shift') return 'Shift';
      if (lower === 'meta' || lower === 'cmd' || lower === 'command') return 'Cmd';
      if (lower === 'arrowdown') return '↓';
      if (lower === 'arrowup') return '↑';
      if (lower === 'arrowleft') return '←';
      if (lower === 'arrowright') return '→';
      if (lower === 'enter') return 'Enter';
      if (lower === 'escape') return 'Esc';
      if (lower === 'delete') return 'Del';
      if (lower === 'backspace') return '⌫';
      if (lower === 'space') return 'Space';
      return part.toUpperCase();
    })
    .join('+');
}
