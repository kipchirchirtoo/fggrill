/**
 * Keyboard Shortcuts Registry
 * 
 * Single source of truth for all keyboard shortcuts across the application.
 * Organized by module with descriptions for the help overlay.
 */

export interface ShortcutDefinition {
  keys: string | string[];
  description: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface ModuleShortcuts {
  [action: string]: ShortcutDefinition;
}

export const SHORTCUTS = {
  // Global shortcuts (available in all modules)
  global: {
    help: {
      keys: '?',
      description: 'Open keyboard shortcuts help',
      priority: 'high' as const,
    },
    home: {
      keys: 'alt+h',
      description: 'Go to dashboard home',
      priority: 'medium' as const,
    },
    logout: {
      keys: 'alt+q',
      description: 'Log out',
      priority: 'low' as const,
    },
    notifications: {
      keys: 'alt+n',
      description: 'Open notifications',
      priority: 'medium' as const,
    },
  } as ModuleShortcuts,

  // Cashier module shortcuts
  cashier: {
    focusScan: {
      keys: ['f2', '/'],
      description: 'Focus scan/search input',
      priority: 'high' as const,
    },
    processPayment: {
      keys: 'ctrl+p',
      description: 'Process payment',
      priority: 'high' as const,
    },
    generateBill: {
      keys: 'ctrl+shift+p',
      description: 'Generate bill',
      priority: 'medium' as const,
    },
    clearCart: {
      keys: 'ctrl+n',
      description: 'Clear cart / New transaction',
      priority: 'medium' as const,
    },
    mpesaMode: {
      keys: 'ctrl+m',
      description: 'Switch to M-Pesa payment',
      priority: 'high' as const,
    },
    cashMode: {
      keys: 'ctrl+1',
      description: 'Switch to Cash payment',
      priority: 'medium' as const,
    },
    mpesaPayment: {
      keys: 'ctrl+2',
      description: 'Switch to M-Pesa payment',
      priority: 'medium' as const,
    },
    cardPayment: {
      keys: 'ctrl+3',
      description: 'Switch to Card payment',
      priority: 'medium' as const,
    },
    viewLogbook: {
      keys: 'alt+l',
      description: 'View cashier logbook',
      priority: 'low' as const,
    },
    viewInsights: {
      keys: 'alt+i',
      description: 'View insights & analytics',
      priority: 'low' as const,
    },
  } as ModuleShortcuts,

  // POS module shortcuts
  pos: {
    focusSearch: {
      keys: ['f2', '/'],
      description: 'Focus item search',
      priority: 'high' as const,
    },
    addItem: {
      keys: 'enter',
      description: 'Add highlighted item to cart',
      priority: 'high' as const,
    },
    increaseQty: {
      keys: ['+', '='],
      description: 'Increase quantity',
      priority: 'high' as const,
    },
    decreaseQty: {
      keys: '-',
      description: 'Decrease quantity',
      priority: 'high' as const,
    },
    removeItem: {
      keys: 'delete',
      description: 'Remove selected item',
      priority: 'medium' as const,
    },
    sendToKitchen: {
      keys: 'ctrl+s',
      description: 'Send order to kitchen',
      priority: 'high' as const,
    },
    generateBill: {
      keys: 'ctrl+p',
      description: 'Generate bill / Print',
      priority: 'high' as const,
    },
    newOrder: {
      keys: 'ctrl+n',
      description: 'New order / Clear cart',
      priority: 'medium' as const,
    },
    dineInMode: {
      keys: 'ctrl+d',
      description: 'Switch to Dine-In mode',
      priority: 'medium' as const,
    },
    takeawayMode: {
      keys: 'ctrl+t',
      description: 'Switch to Takeaway mode',
      priority: 'medium' as const,
    },
    roomServiceMode: {
      keys: 'ctrl+r',
      description: 'Switch to Room Service mode',
      priority: 'low' as const,
    },
    recallOrder: {
      keys: 'ctrl+h',
      description: 'Recall held order',
      priority: 'low' as const,
    },
    cashPayment: {
      keys: 'ctrl+1',
      description: 'Select Cash payment',
      priority: 'medium' as const,
    },
    mpesaPayment: {
      keys: 'ctrl+2',
      description: 'Select M-Pesa payment',
      priority: 'medium' as const,
    },
    cardPayment: {
      keys: 'ctrl+3',
      description: 'Select Card payment',
      priority: 'medium' as const,
    },
  } as ModuleShortcuts,

  // Auditor module shortcuts
  auditor: {
    approve: {
      keys: 'ctrl+a',
      description: 'Approve selected record',
      priority: 'high' as const,
    },
    reject: {
      keys: 'ctrl+x',
      description: 'Reject selected record',
      priority: 'medium' as const,
    },
    openDetail: {
      keys: 'enter',
      description: 'Open detail view',
      priority: 'high' as const,
    },
    nextRecord: {
      keys: ['arrowdown', 'j'],
      description: 'Navigate to next record',
      priority: 'high' as const,
    },
    prevRecord: {
      keys: ['arrowup', 'k'],
      description: 'Navigate to previous record',
      priority: 'high' as const,
    },
    flag: {
      keys: 'ctrl+f',
      description: 'Flag for review',
      priority: 'medium' as const,
    },
    export: {
      keys: 'ctrl+e',
      description: 'Export report',
      priority: 'medium' as const,
    },
    search: {
      keys: '/',
      description: 'Focus search',
      priority: 'high' as const,
    },
  } as ModuleShortcuts,

  // Branch Accountant module shortcuts
  branchAccountant: {
    confirm: {
      keys: 'ctrl+a',
      description: 'Confirm payment',
      priority: 'high' as const,
    },
    reject: {
      keys: 'ctrl+x',
      description: 'Reject payment',
      priority: 'medium' as const,
    },
    reconcile: {
      keys: 'ctrl+r',
      description: 'Open reconciliation view',
      priority: 'medium' as const,
    },
    journalEntry: {
      keys: 'ctrl+j',
      description: 'Post journal entry',
      priority: 'low' as const,
    },
    export: {
      keys: 'ctrl+e',
      description: 'Export report',
      priority: 'medium' as const,
    },
    prevPeriod: {
      keys: 'ctrl+arrowleft',
      description: 'Navigate to previous period',
      priority: 'low' as const,
    },
    nextPeriod: {
      keys: 'ctrl+arrowright',
      description: 'Navigate to next period',
      priority: 'low' as const,
    },
  } as ModuleShortcuts,

  // Central Store module shortcuts
  centralStore: {
    newPO: {
      keys: 'ctrl+n',
      description: 'New purchase order',
      priority: 'high' as const,
    },
    search: {
      keys: ['/', 'f2'],
      description: 'Search items/suppliers',
      priority: 'high' as const,
    },
    saveDraft: {
      keys: 'ctrl+s',
      description: 'Save PO draft',
      priority: 'medium' as const,
    },
    submitPO: {
      keys: 'ctrl+shift+s',
      description: 'Submit PO for approval',
      priority: 'high' as const,
    },
    approvePO: {
      keys: 'ctrl+a',
      description: 'Approve purchase order',
      priority: 'high' as const,
    },
    receiveGoods: {
      keys: 'ctrl+g',
      description: 'Receive goods (GRN)',
      priority: 'medium' as const,
    },
    print: {
      keys: 'ctrl+p',
      description: 'Print purchase order',
      priority: 'medium' as const,
    },
  } as ModuleShortcuts,

  // Branch Store module shortcuts
  branchStore: {
    newRequest: {
      keys: 'ctrl+n',
      description: 'New stock request',
      priority: 'high' as const,
    },
    search: {
      keys: ['/', 'f2'],
      description: 'Search stock items',
      priority: 'high' as const,
    },
    submit: {
      keys: 'ctrl+s',
      description: 'Submit request',
      priority: 'high' as const,
    },
    approve: {
      keys: 'ctrl+a',
      description: 'Approve issue',
      priority: 'medium' as const,
    },
    viewStock: {
      keys: 'ctrl+l',
      description: 'View stock levels',
      priority: 'medium' as const,
    },
    print: {
      keys: 'ctrl+p',
      description: 'Print issue note',
      priority: 'low' as const,
    },
  } as ModuleShortcuts,

  // Reception module shortcuts
  reception: {
    newBooking: {
      keys: 'ctrl+n',
      description: 'New booking',
      priority: 'high' as const,
    },
    checkIn: {
      keys: 'ctrl+i',
      description: 'Check in guest',
      priority: 'high' as const,
    },
    checkOut: {
      keys: 'ctrl+o',
      description: 'Check out guest',
      priority: 'high' as const,
    },
    search: {
      keys: ['/', 'f2'],
      description: 'Search guest/booking',
      priority: 'high' as const,
    },
    roomStatus: {
      keys: 'ctrl+r',
      description: 'Open room status view',
      priority: 'medium' as const,
    },
    print: {
      keys: 'ctrl+p',
      description: 'Print invoice',
      priority: 'medium' as const,
    },
    markClean: {
      keys: 'ctrl+k',
      description: 'Mark room as clean',
      priority: 'medium' as const,
    },
  } as ModuleShortcuts,
};

/**
 * Get shortcuts for a specific module
 */
export function getModuleShortcuts(module: keyof typeof SHORTCUTS): ModuleShortcuts {
  return SHORTCUTS[module] || {};
}

/**
 * Get all shortcuts (for help overlay)
 */
export function getAllShortcuts() {
  return SHORTCUTS;
}

/**
 * Check if a module has shortcuts defined
 */
export function hasShortcuts(module: string): boolean {
  return module in SHORTCUTS;
}
