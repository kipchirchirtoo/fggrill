'use client';

import { useState, useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { getAllShortcuts, type ModuleShortcuts } from '@/config/keyboardShortcuts';
import { formatShortcut } from '@/hooks/useKeyboardShortcut';
import { IOSCard } from './ui/ios-card';
import { IOSButton } from './ui/ios-button';

interface KeyboardShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentModule?: string;
}

export function KeyboardShortcutOverlay({
  isOpen,
  onClose,
  currentModule = 'global',
}: KeyboardShortcutOverlayProps) {
  const [activeTab, setActiveTab] = useState(currentModule);
  const shortcuts = getAllShortcuts();

  // Update active tab when current module changes
  useEffect(() => {
    if (isOpen && currentModule) {
      setActiveTab(currentModule);
    }
  }, [isOpen, currentModule]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modules = Object.keys(shortcuts);
  const currentShortcuts = shortcuts[activeTab as keyof typeof shortcuts] as ModuleShortcuts;

  // Sort shortcuts by priority
  const sortedShortcuts = Object.entries(currentShortcuts || {}).sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const aPriority = a[1].priority || 'medium';
    const bPriority = b[1].priority || 'medium';
    return priorityOrder[aPriority] - priorityOrder[bPriority];
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 flex flex-col">
        <IOSCard className="flex flex-col max-h-full overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stone-200 bg-gradient-to-r from-stone-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Keyboard className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-900">Keyboard Shortcuts</h2>
                <p className="text-sm text-stone-500">Press ? to toggle this help</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition-colors text-stone-400 hover:text-stone-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Module Tabs */}
          <div className="flex gap-2 px-6 pt-4 pb-2 border-b border-stone-100 overflow-x-auto no-scrollbar bg-stone-50/50">
            {modules.map((module) => (
              <button
                key={module}
                onClick={() => setActiveTab(module)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  activeTab === module
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
                }`}
              >
                {module === 'global' ? '🌐 Global' :
                 module === 'cashier' ? '💰 Cashier' :
                 module === 'pos' ? '🍽️ POS' :
                 module === 'auditor' ? '🔍 Auditor' :
                 module === 'branchAccountant' ? '📊 Accountant' :
                 module === 'centralStore' ? '📦 Central Store' :
                 module === 'branchStore' ? '🏪 Branch Store' :
                 module === 'reception' ? '🏨 Reception' :
                 module}
              </button>
            ))}
          </div>

          {/* Shortcuts List */}
          <div className="flex-1 overflow-y-auto p-6">
            {sortedShortcuts.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <Keyboard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No shortcuts defined for this module</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sortedShortcuts.map(([action, shortcut]) => {
                  const keys = Array.isArray(shortcut.keys) ? shortcut.keys : [shortcut.keys];
                  const priorityColor =
                    shortcut.priority === 'high' ? 'border-l-indigo-500' :
                    shortcut.priority === 'medium' ? 'border-l-amber-500' :
                    'border-l-stone-300';

                  return (
                    <div
                      key={action}
                      className={`flex items-center justify-between p-3 bg-white border-l-4 ${priorityColor} rounded-lg hover:shadow-sm transition-shadow`}
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium text-stone-900 truncate">
                          {shortcut.description}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {keys.map((key, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            {idx > 0 && (
                              <span className="text-xs text-stone-400 mx-1">or</span>
                            )}
                            <kbd className="px-2 py-1 text-xs font-mono font-semibold text-stone-700 bg-stone-100 border border-stone-300 rounded shadow-sm">
                              {formatShortcut(key)}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-stone-200 bg-stone-50/50">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-indigo-500 rounded-sm" />
                <span>High Priority</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-amber-500 rounded-sm" />
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-stone-300 rounded-sm" />
                <span>Low</span>
              </div>
            </div>
            <IOSButton
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="min-w-[100px]"
            >
              Close
            </IOSButton>
          </div>
        </IOSCard>
      </div>
    </div>
  );
}

/**
 * Hook to manage keyboard shortcut overlay state
 */
export function useKeyboardShortcutOverlay(currentModule?: string) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleQuestionMark = (e: KeyboardEvent) => {
      // Only trigger on '?' (Shift + /)
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleQuestionMark);
    return () => window.removeEventListener('keydown', handleQuestionMark);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}
